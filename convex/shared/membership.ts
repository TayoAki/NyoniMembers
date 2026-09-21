/**
 * The house's memberships as sold on nyonicouture.com. Membership is a status the house sets on a
 * member's record (staff console, later a WooCommerce sync); the app never bills for it. "client"
 * is everyone else: an account with the collection, looks and previews, but no allowance.
 */
export const MEMBERSHIP_TIERS = ["client", "signature", "prestige", "circle_elite"] as const;
export type MembershipTier = (typeof MEMBERSHIP_TIERS)[number];

export const MEMBERSHIP_STATUSES = ["active", "lapsed"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export type Membership = {
  tier: MembershipTier;
  status: MembershipStatus;
  /** When this tier started, as set by the house. */
  since?: number;
  /** Annual renewal date, when the house has recorded one. */
  renewsAt?: number;
  /** Staff note, shown only in the staff console. */
  note?: string;
  updatedAt: number;
};

export const DEFAULT_MEMBERSHIP: Omit<Membership, "updatedAt"> = { tier: "client", status: "active" };

export const TIER_LABELS: Record<MembershipTier, string> = {
  client: "Client",
  signature: "Signature",
  prestige: "Prestige",
  circle_elite: "Circle Elite",
};

export const TIER_BLURBS: Record<MembershipTier, string> = {
  client: "Your wardrobe, the Nyoni collection and previews on your own photo. Membership is arranged with the house.",
  signature: "A suit every six months, priority booking, complimentary alterations and your concierge.",
  prestige: "A suit every quarter, fittings at your convenience, first look at new arrivals and private events.",
  circle_elite: "A fully bespoke wardrobe, by invitation, with a dedicated concierge.",
};

/** Suits per year included in the tier; null means the wardrobe is arranged piece by piece with the house. */
export const SUITS_PER_YEAR: Record<MembershipTier, number | null> = {
  client: 0,
  signature: 2,
  prestige: 4,
  circle_elite: null,
};

export const TIER_BENEFITS: Record<MembershipTier, readonly string[]> = {
  client: [
    "The Nyoni collection in your wardrobe",
    "Looks and previews on your own photo",
    "The concierge for styling questions",
  ],
  signature: [
    "One suit every six months, made to your measurements",
    "Priority booking for fittings and appointments",
    "Complimentary alterations on qualifying orders",
    "Member savings on made-to-measure and bespoke",
    "Your personal concierge for styling, fittings and special requests",
    "Measurements and preferences saved to your profile",
  ],
  prestige: [
    "One suit every quarter, made to your measurements",
    "Fittings at your convenience",
    "Complimentary alterations on qualifying orders",
    "Member savings on made-to-measure and bespoke",
    "First look at new collections and limited releases",
    "Invitations to private events, trunk shows and member evenings",
    "Your personal concierge for styling, fittings and special requests",
  ],
  circle_elite: [
    "A fully bespoke wardrobe",
    "Fittings at your convenience, wherever suits you",
    "Complimentary alterations",
    "First look at new collections and private events",
    "A dedicated concierge",
    "By invitation of the house",
  ],
};

export function isMembershipTier(value: string): value is MembershipTier {
  return (MEMBERSHIP_TIERS as readonly string[]).includes(value);
}

export function isMembershipStatus(value: string): value is MembershipStatus {
  return (MEMBERSHIP_STATUSES as readonly string[]).includes(value);
}
