import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { audit, type Actor } from "../../atelier/access";
import type { EligibilityView, RedemptionView } from "../../atelier/benefits";
import { appError } from "../../lib/errors";
import { QUOTE_STATUS_LABELS, type RedemptionStatus } from "../../shared/atelier/enums";
import { isMembershipTier, TIER_CLOTH, TIER_LABELS, type MembershipStatus, type MembershipTier } from "../../shared/membership";
import { membershipOf } from "../users";

type Ctx = QueryCtx | MutationCtx;
type User = Doc<"users">;
type Redemption = Doc<"atelierBenefitRedemptions">;

/**
 * The annual suit (contract §5.8; journey C14; screen S18). Entitlement comes from `users.membership`,
 * which only the house writes; nothing here is derived from what the client sees or clicks. A reservation
 * is made by finance against a quote, redeemed when the client accepts that quote, and released when the
 * quote is withdrawn or expires. Browsing never reserves (C14 acceptance).
 *
 *   (none) ──▶ reserved ──▶ redeemed
 *                 └───────▶ released ──▶ (a new reservation may follow)
 *
 * One reservation or redemption per member per membership year.
 */

export const REDEMPTION_STATUS_LABELS: Record<RedemptionStatus, string> = {
  reserved: "Reserved against a quote awaiting your approval",
  redeemed: "Used on an accepted commission",
  released: "Released",
};

/** Redemption rows read per member per year; policy allows one live row, history keeps the rest. */
const REDEMPTIONS_PER_YEAR_MAX = 10;
export const BENEFIT_NOTE_MAX = 500;

// ------------------------------------------------------------------------------------------------
// The membership year
// ------------------------------------------------------------------------------------------------

/**
 * The start of the membership year that contains `now`: the most recent anniversary of `since` (UTC).
 * A start in the future is its own year; February 29 falls on March 1 in a common year.
 */
export function membershipYearStart(since: number, now: number): number {
  if (since > now) return since;
  const start = new Date(since);
  const anniversary = (year: number) =>
    Date.UTC(
      year,
      start.getUTCMonth(),
      start.getUTCDate(),
      start.getUTCHours(),
      start.getUTCMinutes(),
      start.getUTCSeconds(),
      start.getUTCMilliseconds(),
    );
  const nowYear = new Date(now).getUTCFullYear();
  const thisYear = anniversary(nowYear);
  return thisYear <= now ? thisYear : anniversary(nowYear - 1);
}

/** "YYYY" of the membership year containing `now`, counted from `membership.since` or the account's creation. */
export function membershipYearKey(user: Pick<User, "membership" | "createdAt">, now: number = Date.now()): string {
  const since = user.membership?.since ?? user.createdAt;
  return String(new Date(membershipYearStart(since, now)).getUTCFullYear());
}

// ------------------------------------------------------------------------------------------------
// Reads
// ------------------------------------------------------------------------------------------------

export async function redemptionsForYear(ctx: Ctx, userId: Id<"users">, yearKey: string): Promise<Redemption[]> {
  return ctx.db
    .query("atelierBenefitRedemptions")
    .withIndex("by_user_year", (q) => q.eq("userId", userId).eq("membershipYearKey", yearKey))
    .take(REDEMPTIONS_PER_YEAR_MAX);
}

/** The row that holds the year's suit: a redemption, else a reservation, else none. */
export function liveRedemption(rows: readonly Redemption[]): Redemption | null {
  return rows.find((row) => row.status === "redeemed") ?? rows.find((row) => row.status === "reserved") ?? null;
}

export async function activeRedemption(ctx: Ctx, userId: Id<"users">, yearKey: string): Promise<Redemption | null> {
  return liveRedemption(await redemptionsForYear(ctx, userId, yearKey));
}

export async function requireRedemption(ctx: Ctx, redemptionId: Id<"atelierBenefitRedemptions">): Promise<Redemption> {
  const redemption = await ctx.db.get(redemptionId);
  if (!redemption) throw appError("NOT_FOUND", "That benefit reservation doesn't exist.");
  return redemption;
}

export function tierLabel(tier: string): string {
  return isMembershipTier(tier) ? TIER_LABELS[tier] : tier;
}

/** The sentence a quote carries beside its benefit line. */
export function benefitDescription(tier: string): string {
  const cloth = isMembershipTier(tier) ? TIER_CLOTH[tier] : null;
  return cloth
    ? `Your ${tierLabel(tier)} membership includes one made-to-measure suit this membership year, cut in ${cloth}.`
    : `Included with your ${tierLabel(tier)} membership.`;
}

export function toRedemptionView(redemption: Redemption): RedemptionView {
  return {
    redemptionId: redemption._id,
    status: redemption.status,
    statusLabel: REDEMPTION_STATUS_LABELS[redemption.status],
    yearKey: redemption.membershipYearKey,
    reservedAt: redemption.reservedAt,
    redeemedAt: redemption.redeemedAt ?? null,
    releasedAt: redemption.releasedAt ?? null,
    quoteId: redemption.quoteId ?? null,
    orderId: redemption.orderId ?? null,
  };
}

/** The one sentence S18 shows under the tier. It names the state the house holds and never invents a benefit. */
export function eligibilityReason(
  tier: MembershipTier,
  status: MembershipStatus,
  yearKey: string,
  redemption: Pick<Redemption, "status"> | null,
): string {
  if (tier === "client") {
    return "Your account is not part of the Nyoni Circle. Membership includes one made-to-measure suit each year and is joined with the house, not in this app; your concierge can tell you more.";
  }
  const label = TIER_LABELS[tier];
  if (status !== "active") {
    return `Your ${label} membership has lapsed, so this year's suit is not included. Speak with your concierge to renew; your designs are kept.`;
  }
  if (redemption?.status === "redeemed") {
    return `Your included suit for ${yearKey} has been used on an accepted commission. Another suit this year is quoted at the house's usual terms.`;
  }
  if (redemption?.status === "reserved") {
    return `Your included suit for ${yearKey} is reserved against a quote awaiting your approval. It is used only when you accept that quote.`;
  }
  const cloth = TIER_CLOTH[tier] ?? "Nyoni Fabric";
  return `Your ${label} membership includes one made-to-measure suit this membership year (${yearKey}), cut in ${cloth}. Your concierge applies it when your quote is prepared; browsing and designing do not use it.`;
}

/** S18. What the house holds for this member, from `users.membership` and the redemption rows only. */
export async function eligibilityFor(ctx: Ctx, user: User, now: number = Date.now()): Promise<EligibilityView> {
  const membership = membershipOf(user);
  const yearKey = membershipYearKey(user, now);
  const included = membership.tier !== "client" && membership.status === "active";
  const redemption = membership.tier === "client" ? null : await activeRedemption(ctx, user._id, yearKey);
  return {
    tier: membership.tier,
    tierLabel: TIER_LABELS[membership.tier],
    status: membership.status,
    included,
    available: included && redemption === null,
    yearKey,
    cloth: TIER_CLOTH[membership.tier],
    redemption: redemption ? toRedemptionView(redemption) : null,
    reason: eligibilityReason(membership.tier, membership.status, yearKey, redemption),
  };
}

// ------------------------------------------------------------------------------------------------
// Reserve, redeem, release
// ------------------------------------------------------------------------------------------------

export type ReserveInput = { userId: Id<"users">; quoteId: Id<"atelierQuotes"> };

/**
 * O04. Finance reserves the member's suit against a quote being prepared or offered. Server-controlled
 * and retry-safe: the same quote returns the same reservation; a second quote in the same membership
 * year is refused while one is live.
 */
export async function reserveBenefit(
  ctx: MutationCtx,
  staff: User,
  input: ReserveInput,
  now: number = Date.now(),
): Promise<Id<"atelierBenefitRedemptions">> {
  const member = await ctx.db.get(input.userId);
  if (!member) throw appError("NOT_FOUND", "That member doesn't exist.");
  const membership = membershipOf(member);
  if (membership.tier === "client") {
    throw appError("NOT_ELIGIBLE", "This account is not a member of the Nyoni Circle, so no suit is included.");
  }
  if (membership.status !== "active") {
    throw appError("NOT_ELIGIBLE", `This ${TIER_LABELS[membership.tier]} membership has lapsed; renew it before applying the included suit.`);
  }
  const quote = await ctx.db.get(input.quoteId);
  if (!quote) throw appError("NOT_FOUND", "That quote doesn't exist.");
  if (quote.status !== "draft" && quote.status !== "offered") {
    throw appError(
      "INVALID_STATE",
      `Quote version ${quote.version} is ${QUOTE_STATUS_LABELS[quote.status].toLowerCase()}; the benefit can be applied only to a quote being prepared or offered.`,
    );
  }
  const caseDoc = await ctx.db.get(quote.caseId);
  if (!caseDoc || caseDoc.userId !== member._id) {
    throw appError("NOT_ELIGIBLE", "This quote is not for this member's commission.");
  }
  const yearKey = membershipYearKey(member, now);
  const existing = await activeRedemption(ctx, member._id, yearKey);
  if (existing) {
    if (existing.status === "reserved" && existing.quoteId === quote._id) {
      if (quote.benefit?.redemptionId !== existing._id) {
        await ctx.db.patch(quote._id, { benefit: { tier: existing.tier, redemptionId: existing._id, description: benefitDescription(existing.tier) } });
      }
      return existing._id;
    }
    throw appError(
      "INVALID_STATE",
      existing.status === "redeemed"
        ? `The included suit for ${yearKey} has already been used on a commission.`
        : `The included suit for ${yearKey} is already reserved against another quote. Release that reservation first.`,
    );
  }
  const redemptionId = await ctx.db.insert("atelierBenefitRedemptions", {
    userId: member._id,
    membershipYearKey: yearKey,
    tier: membership.tier,
    status: "reserved",
    quoteId: quote._id,
    reservedAt: now,
  });
  await ctx.db.patch(quote._id, { benefit: { tier: membership.tier, redemptionId, description: benefitDescription(membership.tier) } });
  await audit(
    ctx,
    {
      actor: staff,
      action: "benefit.reserve",
      targetTable: "atelierBenefitRedemptions",
      targetId: redemptionId,
      meta: { userId: member._id, quoteId: quote._id, yearKey, tier: membership.tier },
    },
    now,
  );
  return redemptionId;
}

/** Moves a live reservation to the quote that now carries it (a superseding quote). */
export async function moveReservation(ctx: MutationCtx, redemption: Redemption, quoteId: Id<"atelierQuotes">): Promise<void> {
  if (redemption.status !== "reserved") throw appError("INVALID_STATE", "Only a live reservation can move to another quote.");
  if (redemption.quoteId !== quoteId) await ctx.db.patch(redemption._id, { quoteId });
}

/** The client accepted the quote: the year's suit is used, and the commission it went to is recorded. */
export async function redeemReservation(
  ctx: MutationCtx,
  actor: Actor,
  redemption: Redemption,
  quoteId: Id<"atelierQuotes">,
  orderId: Id<"atelierOrders">,
  now: number = Date.now(),
): Promise<void> {
  if (redemption.status !== "reserved") {
    throw appError(
      "INVALID_STATE",
      redemption.status === "redeemed" ? "This benefit has already been used on a commission." : "This benefit reservation was released and cannot be used.",
    );
  }
  await ctx.db.patch(redemption._id, { status: "redeemed", redeemedAt: now, quoteId, orderId });
  await audit(
    ctx,
    { actor, actorKind: "client", action: "benefit.redeem", targetTable: "atelierBenefitRedemptions", targetId: redemption._id, meta: { quoteId, orderId } },
    now,
  );
}

/**
 * Frees a reservation (quote withdrawn or expired, or finance undoing it) so the member's suit is
 * available again. A quote still being prepared or offered stops claiming the benefit; finance re-quotes.
 */
export async function releaseReservation(
  ctx: MutationCtx,
  actor: User | Actor | null,
  redemption: Redemption,
  note: string,
  now: number = Date.now(),
): Promise<void> {
  if (redemption.status !== "reserved") {
    throw appError(
      "INVALID_STATE",
      redemption.status === "redeemed"
        ? "This benefit has been used on an accepted commission and cannot be released here; a cancellation or refund is handled through aftercare."
        : "This reservation was already released.",
    );
  }
  const trimmed = note.trim();
  if (trimmed.length > BENEFIT_NOTE_MAX) throw appError("INVALID_INPUT", `Keep the note under ${BENEFIT_NOTE_MAX} characters.`);
  await ctx.db.patch(redemption._id, { status: "released", releasedAt: now, ...(trimmed ? { note: trimmed } : {}) });
  if (redemption.quoteId) {
    const quote = await ctx.db.get(redemption.quoteId);
    if (quote && quote.benefit?.redemptionId === redemption._id && (quote.status === "draft" || quote.status === "offered")) {
      await ctx.db.patch(quote._id, { benefit: undefined });
    }
  }
  await audit(
    ctx,
    { actor, action: "benefit.release", targetTable: "atelierBenefitRedemptions", targetId: redemption._id, meta: { quoteId: redemption.quoteId ?? null, note: trimmed } },
    now,
  );
}
