import { v, type Infer } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import { appError } from "../lib/errors";
import {
  acceptQuote,
  createQuote,
  expireQuotes,
  isClientVisible,
  listForCase as listQuotesForCase,
  listQueue,
  offerQuote,
  QUOTE_LINE_KIND_LABELS,
  requireQuote,
  requireQuoteCase,
  supersedeQuote,
  toQuoteView,
  withdrawQuote,
} from "../model/atelier/quotes";
import { vQuoteLine, vQuoteStatus, vRedemptionStatus } from "../shared/atelier/validators";
import { requireActor, requireOwned, requireStaff, resolveActor } from "./access";
import { ownerArgs, vRevisionSummary } from "./views";

/**
 * Atelier quotes (contract §5.8; journeys C21, O04; screens S27, A04). Thin wrappers: each resolves the
 * actor or the finance role and delegates to `convex/model/atelier/quotes.ts`. A client reaches a quote
 * only through the request (case) they own; a quote still being prepared is not shown to them. Nothing
 * here records a payment: acceptance creates the commission in preflight and says so.
 */

export { QUOTE_LINE_KIND_LABELS };

export const vQuoteLineView = v.object({ ...vQuoteLine.fields, kindLabel: v.string() });
export type QuoteLineView = Infer<typeof vQuoteLineView>;

/** The benefit a quote carries: the tier's words and whether the reservation is still live. No ids. */
export const vQuoteBenefitView = v.object({
  tier: v.string(),
  tierLabel: v.string(),
  description: v.string(),
  redemptionStatus: vRedemptionStatus,
});

export const vQuoteView = v.object({
  _id: v.id("atelierQuotes"),
  caseId: v.id("atelierCases"),
  version: v.number(),
  status: vQuoteStatus,
  statusLabel: v.string(),
  lines: v.array(vQuoteLineView),
  subtotalUsd: v.number(),
  totalUsd: v.number(),
  benefit: v.union(vQuoteBenefitView, v.null()),
  leadTimeWeeks: v.union(v.number(), v.null()),
  fittingsIncluded: v.union(v.number(), v.null()),
  terms: v.string(),
  expiresAt: v.number(),
  offeredAt: v.union(v.number(), v.null()),
  acceptedAt: v.union(v.number(), v.null()),
  /** The exact design this quote prices. */
  revision: vRevisionSummary,
  /** False once the design has been revised past the quote: the client is told to await a fresh quote. */
  isCurrentRevision: v.boolean(),
  supersedesId: v.union(v.id("atelierQuotes"), v.null()),
  /** The commission an accepted quote produced. */
  orderId: v.union(v.id("atelierOrders"), v.null()),
  createdAt: v.number(),
});
export type QuoteView = Infer<typeof vQuoteView>;

/** One row of A04: offered quotes by expiry, then those being prepared. */
export const vQuoteQueueItem = v.object({
  quoteId: v.id("atelierQuotes"),
  caseId: v.id("atelierCases"),
  version: v.number(),
  status: vQuoteStatus,
  statusLabel: v.string(),
  totalUsd: v.number(),
  expiresAt: v.number(),
  offeredAt: v.union(v.number(), v.null()),
  clientName: v.string(),
  hasBenefit: v.boolean(),
  isCurrentRevision: v.boolean(),
  createdAt: v.number(),
});
export type QuoteQueueItem = Infer<typeof vQuoteQueueItem>;

/** What finance composes (A04). Totals are never part of it: the house computes them from the lines. */
export const vQuoteInput = v.object({
  lines: v.array(vQuoteLine),
  leadTimeWeeks: v.optional(v.number()),
  fittingsIncluded: v.optional(v.number()),
  terms: v.string(),
  expiresAt: v.number(),
  /** A live reservation of the member's annual suit to carry on this quote. */
  benefitRedemptionId: v.optional(v.id("atelierBenefitRedemptions")),
});
export type QuoteInput = Infer<typeof vQuoteInput>;

// ------------------------------------------------------------------------------------------------
// Client
// ------------------------------------------------------------------------------------------------

/** S27. Every quote offered on one of the client's requests, newest version first. */
export const listForCase = query({
  args: { ...ownerArgs, caseId: v.id("atelierCases") },
  returns: v.array(vQuoteView),
  handler: async (ctx, { guestKey, caseId }) => {
    const actor = await resolveActor(ctx, guestKey);
    const caseDoc = requireOwned(await ctx.db.get(caseId), actor, "request");
    const quotes = (await listQuotesForCase(ctx, caseDoc._id)).filter(isClientVisible);
    return Promise.all(quotes.map((quote) => toQuoteView(ctx, quote)));
  },
});

/** S27. One quote, or null while it is still being prepared or does not exist. */
export const get = query({
  args: { ...ownerArgs, quoteId: v.id("atelierQuotes") },
  returns: v.union(vQuoteView, v.null()),
  handler: async (ctx, { guestKey, quoteId }) => {
    const actor = await resolveActor(ctx, guestKey);
    const quote = await ctx.db.get(quoteId);
    if (!quote) return null;
    requireOwned(await ctx.db.get(quote.caseId), actor, "quote");
    return isClientVisible(quote) ? toQuoteView(ctx, quote) : null;
  },
});

/**
 * C21. Accepts the exact quote version and opens the commission in preflight. Refused when the quote is
 * not offered (INVALID_STATE), expired (QUOTE_EXPIRED), prices a design the client has since changed
 * (STALE_REVISION) or names a cloth the house no longer offers (INVALID_STATE). No payment is recorded.
 */
export const accept = mutation({
  args: { ...ownerArgs, quoteId: v.id("atelierQuotes") },
  returns: v.object({ orderId: v.id("atelierOrders") }),
  handler: async (ctx, { guestKey, quoteId }) => {
    const actor = await requireActor(ctx, guestKey);
    const quote = await requireQuote(ctx, quoteId);
    return acceptQuote(ctx, actor, quote);
  },
});

// ------------------------------------------------------------------------------------------------
// Staff (finance)
// ------------------------------------------------------------------------------------------------

/** A04. Offered quotes soonest to expire first, then quotes being prepared. */
export const queue = query({
  args: {},
  returns: v.array(vQuoteQueueItem),
  handler: async (ctx) => {
    await requireStaff(ctx, "finance");
    return listQueue(ctx);
  },
});

/** A04, case detail. Every version on a case, drafts included, newest first. */
export const staffListForCase = query({
  args: { caseId: v.id("atelierCases") },
  returns: v.array(vQuoteView),
  handler: async (ctx, { caseId }) => {
    await requireStaff(ctx, "finance");
    const quotes = await listQuotesForCase(ctx, caseId);
    return Promise.all(quotes.map((quote) => toQuoteView(ctx, quote)));
  },
});

/** O04. A new version in `draft`, priced server-side from the lines against the case's submitted revision. */
export const create = mutation({
  args: { caseId: v.id("atelierCases"), ...vQuoteInput.fields },
  returns: v.id("atelierQuotes"),
  handler: async (ctx, { caseId, ...input }) => {
    const staff = await requireStaff(ctx, "finance");
    const caseDoc = await ctx.db.get(caseId);
    if (!caseDoc) throw appError("NOT_FOUND", "That request doesn't exist.");
    return createQuote(ctx, staff, caseDoc, input);
  },
});

/** O04. Offers a prepared quote; any quote already offered on the case becomes superseded. */
export const offer = mutation({
  args: { quoteId: v.id("atelierQuotes") },
  returns: v.null(),
  handler: async (ctx, { quoteId }) => {
    const staff = await requireStaff(ctx, "finance");
    const quote = await requireQuote(ctx, quoteId);
    await offerQuote(ctx, staff, quote);
    return null;
  },
});

/** O04. Creates and offers a new version in one step, replacing the quote named. */
export const supersede = mutation({
  args: { quoteId: v.id("atelierQuotes"), ...vQuoteInput.fields },
  returns: v.id("atelierQuotes"),
  handler: async (ctx, { quoteId, ...input }) => {
    const staff = await requireStaff(ctx, "finance");
    const previous = await requireQuote(ctx, quoteId);
    return supersedeQuote(ctx, staff, previous, input);
  },
});

/** O04. Withdraws a quote being prepared or offered; its benefit reservation is released. */
export const withdraw = mutation({
  args: { quoteId: v.id("atelierQuotes"), note: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { quoteId, note }) => {
    const staff = await requireStaff(ctx, "finance");
    const quote = await requireQuote(ctx, quoteId);
    await withdrawQuote(ctx, staff, quote, note);
    return null;
  },
});

/** A04. Which request a quote belongs to, for the composer's navigation. */
export const staffCaseFor = query({
  args: { quoteId: v.id("atelierQuotes") },
  returns: v.union(v.id("atelierCases"), v.null()),
  handler: async (ctx, { quoteId }) => {
    await requireStaff(ctx, "finance");
    const quote = await ctx.db.get(quoteId);
    if (!quote) return null;
    return (await requireQuoteCase(ctx, quote))._id;
  },
});

// ------------------------------------------------------------------------------------------------
// Internal (cron)
// ------------------------------------------------------------------------------------------------

/** Hourly: offered quotes past their expiry become expired and the case says so. Returns how many. */
export const expire = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => expireQuotes(ctx),
});
