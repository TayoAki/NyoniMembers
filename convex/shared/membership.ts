/**
 * The Nyoni Circle, as sold on nyonicouture.com/membership (captured 21 September 2026): three annual
 * tiers, each including one made-to-measure suit a year in a rising grade of Nyoni Fabric. Membership
 * is a status the house sets on a member's record (staff console, later a WooCommerce sync); the app
 * never bills for it. "client" is everyone else: an account with the collection, looks and previews.
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

/** Annual fee as published on the membership page; 0 for a client account. */
export const TIER_PRICE_USD: Record<MembershipTier, number> = {
  client: 0,
  signature: 549,
  prestige: 749,
  circle_elite: 949,
};

/** The Nyoni Fabric grade the tier's annual suit is cut in. */
export const TIER_CLOTH: Record<MembershipTier, string | null> = {
  client: null,
  signature: "signature Nyoni Fabric",
  prestige: "premium Nyoni Fabric",
  circle_elite: "the finest Nyoni Fabric",
};

export const TIER_BLURBS: Record<MembershipTier, string> = {
  client:
    "Your wardrobe, the Nyoni collection and previews on your own photo. The Nyoni Circle is joined with the house.",
  signature:
    "A made-to-measure suit each year, cut in signature Nyoni Fabric, with priority fittings and your concierge.",
  prestige:
    "A made-to-measure suit each year in premium Nyoni Fabric, saved measurements, early access and private events.",
  circle_elite:
    "A made-to-measure suit each year in the finest Nyoni Fabric, private fittings at your convenience and bespoke priority.",
};

/** Made-to-measure suits included each membership year. */
export const SUITS_PER_YEAR: Record<MembershipTier, number> = {
  client: 0,
  signature: 1,
  prestige: 1,
  circle_elite: 1,
};

/** Privileges as listed on the membership page, each tier adding to the one below. */
export const TIER_BENEFITS: Record<MembershipTier, readonly string[]> = {
  client: [
    "The Nyoni collection in your wardrobe",
    "Looks and previews on your own photo",
    "The concierge for styling questions",
  ],
  signature: [
    "A made-to-measure suit each year in signature Nyoni Fabric",
    "Priority booking and fittings",
    "Complimentary alterations on your suits",
    "Member concierge support",
    "Invitations to member events",
  ],
  prestige: [
    "A made-to-measure suit each year in premium Nyoni Fabric",
    "All Signature privileges",
    "Saved measurements and style profile",
    "Complimentary shipping and alterations",
    "Early access to new collections and private events",
  ],
  circle_elite: [
    "A made-to-measure suit each year in the finest Nyoni Fabric",
    "All Prestige privileges",
    "Private fittings at your convenience",
    "Bespoke priority with limited slots",
    "Access to exclusive experiences",
  ],
};

export function isMembershipTier(value: string): value is MembershipTier {
  return (MEMBERSHIP_TIERS as readonly string[]).includes(value);
}

export function isMembershipStatus(value: string): value is MembershipStatus {
  return (MEMBERSHIP_STATUSES as readonly string[]).includes(value);
}
