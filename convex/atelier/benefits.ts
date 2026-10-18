import { v, type Infer } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireUser } from "../lib/auth";
import {
  eligibilityFor as eligibilityForUser,
  REDEMPTION_STATUS_LABELS,
  releaseReservation,
  requireRedemption,
  reserveBenefit,
} from "../model/atelier/benefits";
import { vRedemptionStatus } from "../shared/atelier/validators";
import { vMembershipStatus, vMembershipTier } from "../shared/validators";
import { requireStaff } from "./access";

/**
 * Atelier benefits: the annual suit (contract §5.8; journey C14; screen S18). Eligibility is read from
 * `users.membership`, which only the house sets; the client's screen can never grant it. Reserving and
 * releasing are finance actions against a quote. Browsing never reserves.
 */

export { REDEMPTION_STATUS_LABELS };

export const vRedemptionView = v.object({
  redemptionId: v.id("atelierBenefitRedemptions"),
  status: vRedemptionStatus,
  statusLabel: v.string(),
  yearKey: v.string(),
  reservedAt: v.number(),
  redeemedAt: v.union(v.number(), v.null()),
  releasedAt: v.union(v.number(), v.null()),
  quoteId: v.union(v.id("atelierQuotes"), v.null()),
  orderId: v.union(v.id("atelierOrders"), v.null()),
});
export type RedemptionView = Infer<typeof vRedemptionView>;

export const vEligibilityView = v.object({
  tier: vMembershipTier,
  tierLabel: v.string(),
  status: vMembershipStatus,
  /** The tier includes a suit and the membership is active. */
  included: v.boolean(),
  /** Included and not yet reserved or used this membership year. */
  available: v.boolean(),
  /** "YYYY" of the membership year containing today, counted from the date the house recorded. */
  yearKey: v.string(),
  /** The Nyoni Fabric grade the tier's suit is cut in, or null for a client account. */
  cloth: v.union(v.string(), v.null()),
  redemption: v.union(vRedemptionView, v.null()),
  /** One sentence in the house's voice explaining the state above. */
  reason: v.string(),
});
export type EligibilityView = Infer<typeof vEligibilityView>;

// ------------------------------------------------------------------------------------------------
// Client
// ------------------------------------------------------------------------------------------------

/** S18. Signed-in only. Reads the house's record; opening this never reserves anything. */
export const myEligibility = query({
  args: {},
  returns: vEligibilityView,
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return eligibilityForUser(ctx, user);
  },
});

// ------------------------------------------------------------------------------------------------
// Staff (finance)
// ------------------------------------------------------------------------------------------------

/** A04. A member's eligibility as the quote composer needs it; null for an unknown account. */
export const forMember = query({
  args: { userId: v.id("users") },
  returns: v.union(vEligibilityView, v.null()),
  handler: async (ctx, { userId }) => {
    await requireStaff(ctx, "finance");
    const user = await ctx.db.get(userId);
    return user ? eligibilityForUser(ctx, user) : null;
  },
});

/**
 * O04. Reserves the member's suit for this membership year against a quote being prepared or offered.
 * One live reservation per member per year; the same quote returns the same reservation.
 */
export const reserve = mutation({
  args: { userId: v.id("users"), quoteId: v.id("atelierQuotes") },
  returns: v.id("atelierBenefitRedemptions"),
  handler: async (ctx, input) => {
    const staff = await requireStaff(ctx, "finance");
    return reserveBenefit(ctx, staff, input);
  },
});

/** O04. Frees a reservation so the member's suit is available again; the quote stops claiming it. */
export const release = mutation({
  args: { redemptionId: v.id("atelierBenefitRedemptions"), note: v.string() },
  returns: v.null(),
  handler: async (ctx, { redemptionId, note }) => {
    const staff = await requireStaff(ctx, "finance");
    const redemption = await requireRedemption(ctx, redemptionId);
    await releaseReservation(ctx, staff, redemption, note);
    return null;
  },
});
