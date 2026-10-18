import { makeFunctionReference } from "convex/server";
import type { RedemptionStatus } from "@convex/shared/atelier/enums";
import type { MembershipStatus, MembershipTier } from "@convex/shared/membership";

/**
 * `benefits.myEligibility` as the contract defines it (docs/08-atelier-build-contract.md §5.8):
 * `{ tier, status, included, yearKey, redemption | null, reason }` read from `users.membership` only.
 * `convex/atelier/benefits.ts` is still a stub, so this file names the function by path and keeps
 * the page compiling; swap for `api.atelier.benefits.myEligibility` once the module exports it.
 */
export type BenefitRedemption = {
  status: RedemptionStatus;
  reservedAt: number;
  redeemedAt?: number;
  releasedAt?: number;
  quoteId?: string;
  orderId?: string;
};

export type Eligibility = {
  tier: MembershipTier;
  status: MembershipStatus;
  /** True when the annual suit is available this membership year, and nothing has yet claimed it. */
  included: boolean;
  yearKey: string;
  redemption: BenefitRedemption | null;
  reason: string;
};

export const myEligibilityRef = makeFunctionReference<"query", Record<string, never>, Eligibility>(
  "atelier/benefits:myEligibility",
);

/** The redemption states in words; `enums.ts` has no label map for REDEMPTION_STATUSES (reported). */
export const REDEMPTION_WORDS: Record<RedemptionStatus, string> = {
  reserved: "Reserved against a quote · not yet used",
  redeemed: "Used for a commission this year",
  released: "Released · available again",
};
