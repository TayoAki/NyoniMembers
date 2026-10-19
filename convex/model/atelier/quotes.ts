import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { audit, isOwner, type Actor, type Owned } from "../../atelier/access";
import type { QuoteInput, QuoteQueueItem, QuoteView } from "../../atelier/quotes";
import { appError } from "../../lib/errors";
import { QUOTE_LINE_KIND_LABELS, QUOTE_STATUS_LABELS, type QuoteStatus } from "../../shared/atelier/enums";
import { computeTotals, QUOTE_LINES_MAX, roundUsd, validateLines } from "../../shared/atelier/quote_lines";
import { specHash } from "../../shared/atelier/spec";
import type { Contact } from "./case_core";
import { benefitDescription, moveReservation, redeemReservation, releaseReservation, tierLabel } from "./benefits";
import { getEntry } from "./catalogue";
import { appendMessage, touchCase } from "./case_core";
import { queueNotification } from "./notifications";
import { createOrder, formatDay, formatUsd, orderForQuote } from "./orders";
import { latestRevision, toRevisionSummary } from "./revisions";

type Ctx = QueryCtx | MutationCtx;
type Quote = Doc<"atelierQuotes">;
type Case = Doc<"atelierCases">;
type Revision = Doc<"atelierRevisions">;
type User = Doc<"users">;
type QuoteLine = Quote["lines"][number];

/**
 * Priced offers (contract §5.8; journeys C21, O04; screens S27, A04). From SCREENS-AND-STATES.md:
 *
 *   draft ──▶ offered ──▶ accepted
 *     │          ├──────▶ expired      (the hourly cron, past `expiresAt`)
 *     │          ├──────▶ superseded   (a newer quote on the case is offered)
 *     └──────────┴──────▶ withdrawn
 *
 * A quote prices one immutable revision. Totals are computed here from the lines, never trusted from a
 * client. Acceptance requires the design to still be the one priced (STALE_REVISION otherwise: a client
 * cannot pay an old quote for a new design), the cloth to still be offered, and the quote to be offered
 * and in date. Accepting creates the commission in preflight; it records no payment and releases nothing.
 */

export { QUOTE_LINE_KIND_LABELS };

const OPEN_STATUSES: readonly QuoteStatus[] = ["draft", "offered"];
const QUOTES_PER_CASE_MAX = 50;
const QUEUE_MAX = 100;
/** Offered quotes examined per cron run; the index orders them by expiry so the run stops at the first in date. */
const EXPIRE_BATCH = 200;
export const QUOTE_TERMS_MAX = 4000;

export { computeTotals, QUOTE_LINES_MAX, validateLines };

function normalizeLines(lines: readonly QuoteLine[]): QuoteLine[] {
  return lines.map((line) => ({
    code: line.code.trim(),
    label: line.label.trim(),
    amountUsd: roundUsd(line.amountUsd),
    kind: line.kind,
  }));
}

// ------------------------------------------------------------------------------------------------
// Reads
// ------------------------------------------------------------------------------------------------

export async function requireQuote(ctx: Ctx, quoteId: Id<"atelierQuotes">): Promise<Quote> {
  const quote = await ctx.db.get(quoteId);
  if (!quote) throw appError("NOT_FOUND", "That quote doesn't exist.");
  return quote;
}

export async function requireQuoteCase(ctx: Ctx, quote: Quote): Promise<Case> {
  const caseDoc = await ctx.db.get(quote.caseId);
  if (!caseDoc) throw appError("NOT_FOUND", "The request this quote belongs to could not be found.");
  return caseDoc;
}

/** Every version on a case, newest first. */
export async function listForCase(ctx: Ctx, caseId: Id<"atelierCases">): Promise<Quote[]> {
  return ctx.db
    .query("atelierQuotes")
    .withIndex("by_case_version", (q) => q.eq("caseId", caseId))
    .order("desc")
    .take(QUOTES_PER_CASE_MAX);
}

/** A quote being prepared is the house's working paper; the client sees it once it is offered. */
export function isClientVisible(quote: Pick<Quote, "status">): boolean {
  return quote.status !== "draft";
}

export function nextVersion(quotes: readonly Quote[]): number {
  return quotes.reduce((max, quote) => Math.max(max, quote.version), 0) + 1;
}

export function offeredAmong(quotes: readonly Quote[]): Quote | null {
  return quotes.find((quote) => quote.status === "offered") ?? null;
}

/** True while the design the quote prices is still the draft's design and its latest revision. */
export async function isCurrentRevision(ctx: Ctx, quote: Quote, revision: Revision): Promise<boolean> {
  const [draft, latest] = await Promise.all([ctx.db.get(quote.draftId), latestRevision(ctx, quote.draftId)]);
  if (!draft) return false;
  if (specHash(draft.spec) !== revision.specHash) return false;
  return latest === null || latest.specHash === revision.specHash;
}

function caseOwner(caseDoc: Case): Owned {
  return caseDoc.userId ? { userId: caseDoc.userId } : { guestKey: caseDoc.guestKey };
}

function notifyTarget(contact: Contact): { channel: "email" | "sms"; to: string } {
  return contact.channel === "sms" && contact.phone
    ? { channel: "sms", to: contact.phone }
    : { channel: "email", to: contact.email };
}

// ------------------------------------------------------------------------------------------------
// Views
// ------------------------------------------------------------------------------------------------

export async function toQuoteView(ctx: Ctx, quote: Quote): Promise<QuoteView> {
  const revision = await ctx.db.get(quote.revisionId);
  if (!revision) throw appError("NOT_FOUND", "The design this quote prices could not be found.");
  const [summary, current, redemption, order] = await Promise.all([
    toRevisionSummary(ctx, revision),
    isCurrentRevision(ctx, quote, revision),
    quote.benefit ? ctx.db.get(quote.benefit.redemptionId) : Promise.resolve(null),
    quote.status === "accepted" ? orderForQuote(ctx, quote.caseId, quote._id) : Promise.resolve(null),
  ]);
  return {
    _id: quote._id,
    caseId: quote.caseId,
    version: quote.version,
    status: quote.status,
    statusLabel: QUOTE_STATUS_LABELS[quote.status],
    lines: quote.lines.map((line) => ({ ...line, kindLabel: QUOTE_LINE_KIND_LABELS[line.kind] })),
    subtotalUsd: quote.subtotalUsd,
    totalUsd: quote.totalUsd,
    benefit: quote.benefit
      ? {
          tier: quote.benefit.tier,
          tierLabel: tierLabel(quote.benefit.tier),
          description: quote.benefit.description,
          redemptionStatus: redemption?.status ?? "released",
        }
      : null,
    leadTimeWeeks: quote.leadTimeWeeks ?? null,
    fittingsIncluded: quote.fittingsIncluded ?? null,
    terms: quote.terms,
    expiresAt: quote.expiresAt,
    offeredAt: quote.offeredAt ?? null,
    acceptedAt: quote.acceptedAt ?? null,
    revision: summary,
    isCurrentRevision: current,
    supersedesId: quote.supersedesId ?? null,
    orderId: order?._id ?? null,
    createdAt: quote.createdAt,
  };
}

async function toQueueItem(ctx: Ctx, quote: Quote): Promise<QuoteQueueItem> {
  const [caseDoc, revision] = await Promise.all([ctx.db.get(quote.caseId), ctx.db.get(quote.revisionId)]);
  return {
    quoteId: quote._id,
    caseId: quote.caseId,
    version: quote.version,
    status: quote.status,
    statusLabel: QUOTE_STATUS_LABELS[quote.status],
    totalUsd: quote.totalUsd,
    expiresAt: quote.expiresAt,
    offeredAt: quote.offeredAt ?? null,
    clientName: caseDoc?.contact.name ?? "Client",
    hasBenefit: quote.benefit !== undefined,
    isCurrentRevision: revision ? await isCurrentRevision(ctx, quote, revision) : false,
    createdAt: quote.createdAt,
  };
}

/** A04. Offered quotes soonest to expire first, then quotes still being prepared. */
export async function listQueue(ctx: Ctx): Promise<QuoteQueueItem[]> {
  const [offered, drafts] = await Promise.all([
    ctx.db
      .query("atelierQuotes")
      .withIndex("by_status", (q) => q.eq("status", "offered"))
      .order("asc")
      .take(QUEUE_MAX),
    ctx.db
      .query("atelierQuotes")
      .withIndex("by_status", (q) => q.eq("status", "draft"))
      .order("asc")
      .take(QUEUE_MAX),
  ]);
  return Promise.all([...offered, ...drafts].map((quote) => toQueueItem(ctx, quote)));
}

// ------------------------------------------------------------------------------------------------
// Staff (finance)
// ------------------------------------------------------------------------------------------------

/**
 * O04. A new version on the case, priced from the lines, in `draft` until offered. The case must carry a
 * submitted revision, and that revision must still be the draft's design: a quote for a design the
 * client has moved on from could never be accepted.
 */
export async function createQuote(
  ctx: MutationCtx,
  staff: User,
  caseDoc: Case,
  input: QuoteInput,
  now: number = Date.now(),
): Promise<Id<"atelierQuotes">> {
  if (!caseDoc.revisionId || !caseDoc.draftId) {
    throw appError("INVALID_STATE", "This request has no submitted design to price yet.");
  }
  const [revision, draft] = await Promise.all([ctx.db.get(caseDoc.revisionId), ctx.db.get(caseDoc.draftId)]);
  if (!revision || !draft) throw appError("INVALID_STATE", "The submitted design for this request could not be found.");
  if (specHash(draft.spec) !== revision.specHash) {
    throw appError(
      "STALE_REVISION",
      "The design has moved on since it was submitted. The client must send the design again, or accept the proposal that changed it, before it is priced.",
    );
  }
  const lines = normalizeLines(input.lines);
  const lineErrors = validateLines(lines);
  if (lineErrors.length > 0) throw appError("INVALID_INPUT", lineErrors.join(" "), { errors: lineErrors });
  const terms = input.terms.trim();
  if (!terms) throw appError("INVALID_INPUT", "State the terms the client is agreeing to.");
  if (terms.length > QUOTE_TERMS_MAX)
    throw appError("INVALID_INPUT", `Keep the terms under ${QUOTE_TERMS_MAX} characters.`);
  if (!Number.isFinite(input.expiresAt) || input.expiresAt <= now)
    throw appError("INVALID_INPUT", "Choose an expiry in the future.");
  for (const [name, value] of [
    ["leadTimeWeeks", input.leadTimeWeeks],
    ["fittingsIncluded", input.fittingsIncluded],
  ] as const) {
    if (value !== undefined && (!Number.isInteger(value) || value < 0))
      throw appError("INVALID_INPUT", `${name} is a whole number of weeks or fittings.`);
  }

  let benefit: Quote["benefit"];
  if (input.benefitRedemptionId) {
    const redemption = await ctx.db.get(input.benefitRedemptionId);
    if (!redemption || redemption.status !== "reserved") {
      throw appError(
        "INVALID_STATE",
        "That benefit reservation is not live. Reserve the member's suit again before pricing it in.",
      );
    }
    if (!caseDoc.userId || redemption.userId !== caseDoc.userId) {
      throw appError("NOT_ELIGIBLE", "That benefit reservation belongs to a different member than this request.");
    }
    benefit = { tier: redemption.tier, redemptionId: redemption._id, description: benefitDescription(redemption.tier) };
  }

  const existing = await listForCase(ctx, caseDoc._id);
  const version = nextVersion(existing);
  const { subtotalUsd, totalUsd } = computeTotals(lines);
  const quoteId = await ctx.db.insert("atelierQuotes", {
    caseId: caseDoc._id,
    draftId: draft._id,
    revisionId: revision._id,
    version,
    lines,
    subtotalUsd,
    totalUsd,
    benefit,
    leadTimeWeeks: input.leadTimeWeeks,
    fittingsIncluded: input.fittingsIncluded,
    terms,
    expiresAt: input.expiresAt,
    status: "draft",
    createdByStaffId: staff._id,
    createdAt: now,
  });
  if (benefit) {
    const redemption = await ctx.db.get(benefit.redemptionId);
    if (redemption) await moveReservation(ctx, redemption, quoteId);
  }
  await audit(
    ctx,
    {
      actor: staff,
      action: "quote.create",
      targetTable: "atelierQuotes",
      targetId: quoteId,
      meta: { caseId: caseDoc._id, version, totalUsd, revisionId: revision._id },
    },
    now,
  );
  return quoteId;
}

/**
 * O04. Offers the quote to the client. The quote this one replaces (any offered quote on the case) is
 * marked superseded and named in `supersedesId`, its live benefit reservation moving to the new quote.
 * The client sees the system message; the notification is recorded, not sent.
 */
export async function offerQuote(ctx: MutationCtx, staff: User, quote: Quote, now: number = Date.now()): Promise<void> {
  if (quote.status === "offered") return;
  if (quote.status !== "draft") {
    throw appError(
      "INVALID_STATE",
      `Quote version ${quote.version} is ${QUOTE_STATUS_LABELS[quote.status].toLowerCase()} and cannot be offered. Prepare a new version instead.`,
    );
  }
  if (quote.expiresAt <= now)
    throw appError("INVALID_INPUT", "This quote's expiry has passed. Set a new expiry before offering it.");
  const caseDoc = await requireQuoteCase(ctx, quote);
  const previous = offeredAmong(await listForCase(ctx, caseDoc._id));
  let benefit = quote.benefit;
  if (previous && previous._id !== quote._id) {
    await ctx.db.patch(previous._id, { status: "superseded" });
    if (!benefit && previous.benefit) {
      const redemption = await ctx.db.get(previous.benefit.redemptionId);
      if (redemption && redemption.status === "reserved") {
        await moveReservation(ctx, redemption, quote._id);
        benefit = previous.benefit;
      }
    }
    await audit(
      ctx,
      {
        actor: staff,
        action: "quote.supersede",
        targetTable: "atelierQuotes",
        targetId: previous._id,
        meta: { by: quote._id, version: quote.version },
      },
      now,
    );
  }
  await ctx.db.patch(quote._id, {
    status: "offered",
    offeredAt: now,
    ...(benefit && !quote.benefit ? { benefit } : {}),
    ...(previous && previous._id !== quote._id && !quote.supersedesId ? { supersedesId: previous._id } : {}),
  });
  await appendMessage(
    ctx,
    caseDoc._id,
    {
      author: "system",
      body: `A quote is ready for your approval. Version ${quote.version} · ${formatUsd(quote.totalUsd)} · valid until ${formatDay(quote.expiresAt)}.${previous && previous._id !== quote._id ? ` It replaces version ${previous.version}.` : ""}`,
    },
    now,
  );
  await touchCase(
    ctx,
    caseDoc._id,
    { status: "awaiting_client", nextAction: "Client to approve the quote", nextActionDueAt: quote.expiresAt },
    now,
  );
  const target = notifyTarget(caseDoc.contact);
  await queueNotification(
    ctx,
    {
      owner: caseOwner(caseDoc),
      caseId: caseDoc._id,
      channel: target.channel,
      to: target.to,
      subject: "Nyoni Couture · Your quote is ready",
      body: `A quote for your commission is ready for your approval: version ${quote.version}, ${formatUsd(quote.totalUsd)}, valid until ${formatDay(quote.expiresAt)}. Open your request to review it.`,
    },
    now,
  );
  await audit(
    ctx,
    {
      actor: staff,
      action: "quote.offer",
      targetTable: "atelierQuotes",
      targetId: quote._id,
      meta: { caseId: caseDoc._id, version: quote.version, totalUsd: quote.totalUsd },
    },
    now,
  );
}

/** O04. A new version offered in one step; the quote it replaces keeps its history. */
export async function supersedeQuote(
  ctx: MutationCtx,
  staff: User,
  previous: Quote,
  input: QuoteInput,
  now: number = Date.now(),
): Promise<Id<"atelierQuotes">> {
  if (!OPEN_STATUSES.includes(previous.status)) {
    throw appError(
      "INVALID_STATE",
      `Quote version ${previous.version} is ${QUOTE_STATUS_LABELS[previous.status].toLowerCase()}; only a quote being prepared or offered can be replaced.`,
    );
  }
  const caseDoc = await requireQuoteCase(ctx, previous);
  let carried = input.benefitRedemptionId;
  if (!carried && previous.benefit) {
    const redemption = await ctx.db.get(previous.benefit.redemptionId);
    if (redemption && redemption.status === "reserved") carried = redemption._id;
  }
  const quoteId = await createQuote(ctx, staff, caseDoc, { ...input, benefitRedemptionId: carried }, now);
  if (previous.status === "draft") {
    await ctx.db.patch(previous._id, { status: "superseded" });
    await ctx.db.patch(quoteId, { supersedesId: previous._id });
    await audit(
      ctx,
      {
        actor: staff,
        action: "quote.supersede",
        targetTable: "atelierQuotes",
        targetId: previous._id,
        meta: { by: quoteId },
      },
      now,
    );
  }
  const created = await requireQuote(ctx, quoteId);
  await offerQuote(ctx, staff, created, now);
  return quoteId;
}

/** O04. Withdraws a quote being prepared or offered; a live benefit reservation is released. */
export async function withdrawQuote(
  ctx: MutationCtx,
  staff: User,
  quote: Quote,
  note: string | undefined,
  now: number = Date.now(),
): Promise<void> {
  if (!OPEN_STATUSES.includes(quote.status)) {
    throw appError(
      "INVALID_STATE",
      `Quote version ${quote.version} is ${QUOTE_STATUS_LABELS[quote.status].toLowerCase()} and cannot be withdrawn.`,
    );
  }
  await ctx.db.patch(quote._id, { status: "withdrawn" });
  if (quote.benefit) {
    const redemption = await ctx.db.get(quote.benefit.redemptionId);
    if (redemption && redemption.status === "reserved")
      await releaseReservation(ctx, staff, redemption, `Quote version ${quote.version} withdrawn`, now);
  }
  if (quote.status === "offered") {
    await appendMessage(
      ctx,
      quote.caseId,
      {
        author: "system",
        body: `The quote offered on ${formatDay(quote.offeredAt ?? quote.createdAt)} (version ${quote.version}) has been withdrawn by the house. Your concierge will explain and prepare a fresh one if needed. Your design is unchanged.`,
      },
      now,
    );
    await touchCase(
      ctx,
      quote.caseId,
      {
        status: "awaiting_staff",
        nextAction: "Concierge to follow up the withdrawn quote",
        nextActionDueAt: undefined,
      },
      now,
    );
  }
  await audit(
    ctx,
    {
      actor: staff,
      action: "quote.withdraw",
      targetTable: "atelierQuotes",
      targetId: quote._id,
      meta: { version: quote.version, from: quote.status, note: note?.trim() ?? null },
    },
    now,
  );
}

/** The hourly cron: every offered quote past its expiry becomes expired, says so on the case, and frees its benefit. */
export async function expireQuotes(ctx: MutationCtx, now: number = Date.now()): Promise<number> {
  const offered = await ctx.db
    .query("atelierQuotes")
    .withIndex("by_status", (q) => q.eq("status", "offered"))
    .order("asc")
    .take(EXPIRE_BATCH);
  let count = 0;
  for (const quote of offered) {
    if (quote.expiresAt > now) break;
    await ctx.db.patch(quote._id, { status: "expired" });
    if (quote.benefit) {
      const redemption = await ctx.db.get(quote.benefit.redemptionId);
      if (redemption && redemption.status === "reserved")
        await releaseReservation(ctx, null, redemption, `Quote version ${quote.version} expired`, now);
    }
    await appendMessage(
      ctx,
      quote.caseId,
      {
        author: "system",
        body: `The quote offered on ${formatDay(quote.offeredAt ?? quote.createdAt)} (version ${quote.version}) expired on ${formatDay(quote.expiresAt)}. Your design is unchanged; your concierge can prepare a fresh quote for it.`,
      },
      now,
    );
    await touchCase(
      ctx,
      quote.caseId,
      { status: "awaiting_staff", nextAction: "Concierge to re-quote or close", nextActionDueAt: undefined },
      now,
    );
    await audit(
      ctx,
      {
        actor: null,
        action: "quote.expire",
        targetTable: "atelierQuotes",
        targetId: quote._id,
        meta: { version: quote.version, expiresAt: quote.expiresAt },
      },
      now,
    );
    count += 1;
  }
  return count;
}

// ------------------------------------------------------------------------------------------------
// Client
// ------------------------------------------------------------------------------------------------

const ACCEPT_REFUSALS: Record<Exclude<QuoteStatus, "offered">, string> = {
  draft: "This quote is still being prepared and has not been offered yet.",
  accepted: "This quote has already been accepted.",
  expired: "This quote has expired. Ask your concierge for a fresh quote; your design is unchanged.",
  superseded: "A newer quote has replaced this one. Open the latest quote to approve it.",
  withdrawn: "The house withdrew this quote. Your concierge will explain and prepare a fresh one if needed.",
};

/**
 * C21. The client accepts the exact quote version. Refused when the quote is not offered, has expired,
 * prices a design the draft has moved past (the client cannot pay an old quote for a new design), or
 * names a cloth the house no longer offers. Creates the commission in preflight with no payment recorded;
 * a second acceptance of the same quote returns the same commission.
 */
export async function acceptQuote(
  ctx: MutationCtx,
  actor: Actor,
  quote: Quote,
  now: number = Date.now(),
): Promise<{ orderId: Id<"atelierOrders"> }> {
  const caseDoc = await requireQuoteCase(ctx, quote);
  if (!isOwner(caseDoc, actor)) throw appError("NOT_FOUND", "That quote doesn't exist.");
  if (quote.status === "accepted") {
    const existing = await orderForQuote(ctx, caseDoc._id, quote._id);
    if (existing) return { orderId: existing._id };
  }
  if (quote.status !== "offered") throw appError("INVALID_STATE", ACCEPT_REFUSALS[quote.status]);
  if (quote.expiresAt <= now) {
    throw appError(
      "QUOTE_EXPIRED",
      `This quote expired on ${formatDay(quote.expiresAt)}. Ask your concierge for a fresh quote; your design is unchanged.`,
    );
  }
  const [revision, draft] = await Promise.all([ctx.db.get(quote.revisionId), ctx.db.get(quote.draftId)]);
  if (!revision || !draft) throw appError("NOT_FOUND", "The design this quote prices could not be found.");
  const latest = await latestRevision(ctx, draft._id);
  if (specHash(draft.spec) !== revision.specHash || (latest !== null && latest.specHash !== revision.specHash)) {
    throw appError(
      "STALE_REVISION",
      "Your design has changed since this quote was prepared, so this quote cannot be accepted. Your concierge will prepare a fresh quote for the design as it is now.",
    );
  }
  const cloth = revision.spec.clothCode ? await getEntry(ctx, "cloth", revision.spec.clothCode) : null;
  if (!cloth || cloth.status !== "approved") {
    throw appError(
      "INVALID_STATE",
      `${cloth?.name ?? revision.spec.clothCode ?? "The cloth"} is no longer offered by the house, so this quote cannot be accepted as it stands. Choose another cloth with your concierge; a new quote will follow and nothing has been changed on your behalf.`,
    );
  }
  if (!cloth.inStock) {
    throw appError(
      "INVALID_STATE",
      `${cloth.name} is not in stock at the moment, so this quote cannot be accepted yet. Your concierge will confirm whether it can be sourced or help you choose another cloth; a new quote will follow.`,
    );
  }
  const redemption = quote.benefit ? await ctx.db.get(quote.benefit.redemptionId) : null;
  if (quote.benefit && (!redemption || redemption.status !== "reserved")) {
    throw appError(
      "INVALID_STATE",
      "The membership benefit on this quote is no longer reserved. Your concierge will check your membership and prepare a fresh quote.",
    );
  }

  await ctx.db.patch(quote._id, { status: "accepted", acceptedAt: now, acceptedSpecHash: revision.specHash });
  const orderId = await createOrder(
    ctx,
    {
      owner: caseOwner(caseDoc),
      caseId: caseDoc._id,
      quoteId: quote._id,
      revisionId: revision._id,
      draftId: draft._id,
      fitProfileId: draft.fitProfileId,
      spec: revision.spec,
      specHash: revision.specHash,
      eventDate: draft.eventDate ?? revision.eventDate,
    },
    now,
  );
  if (redemption) await redeemReservation(ctx, actor, redemption, quote._id, orderId, now);
  await ctx.db.patch(caseDoc._id, { orderId });
  await appendMessage(
    ctx,
    caseDoc._id,
    {
      author: "system",
      body: `Quote accepted · payment not yet recorded. Version ${quote.version}, ${formatUsd(quote.totalUsd)}. The house will record your payment and check the design before it is released to the cutter.`,
    },
    now,
  );
  await touchCase(
    ctx,
    caseDoc._id,
    { status: "awaiting_staff", nextAction: "Record payment and run preflight", nextActionDueAt: undefined },
    now,
  );
  await audit(
    ctx,
    {
      actor,
      actorKind: "client",
      action: "quote.accept",
      targetTable: "atelierQuotes",
      targetId: quote._id,
      meta: { orderId, version: quote.version, totalUsd: quote.totalUsd, specHash: revision.specHash },
    },
    now,
  );
  return { orderId };
}
