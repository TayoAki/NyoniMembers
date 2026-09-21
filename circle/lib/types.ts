/**
 * The shapes every screen reads. They mirror the schema in docs/05-mobile-app-plan.md §7, so when
 * the Convex backend lands the fixtures are replaced and these types stay.
 */

export const CATEGORIES = ["suit", "top", "bottom", "outerwear", "shoes", "accessory"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  suit: "Suits",
  top: "Shirts and knitwear",
  bottom: "Trousers",
  outerwear: "Jackets and coats",
  shoes: "Shoes",
  accessory: "Accessories",
};

/** A look is built from slots, not a flat list: a suit sits over a top and under outerwear. */
export const SLOTS = ["outerwear", "suit", "top", "bottom", "shoes", "accessories"] as const;
export type Slot = (typeof SLOTS)[number];

export const SLOT_LABELS: Record<Slot, string> = {
  outerwear: "Outerwear",
  suit: "Suit",
  top: "Top",
  bottom: "Trousers",
  shoes: "Shoes",
  accessories: "Accessories",
};

export const SLOT_CATEGORIES: Record<Slot, readonly Category[]> = {
  outerwear: ["outerwear"],
  suit: ["suit"],
  top: ["top"],
  bottom: ["bottom"],
  shoes: ["shoes"],
  accessories: ["accessory"],
};

export type Variation = { size: string; inStock: boolean };

export type Product = {
  id: string;
  name: string;
  priceUsd: number;
  category: Category;
  subcategory: string;
  colour: string;
  pattern: string;
  material: string;
  formality: string;
  permalink: string;
  variations: Variation[];
};

export type Piece = {
  id: string;
  productId?: string;
  name: string;
  category: Category;
  subcategory: string;
  colour: string;
  /** Where it came from: photographed by the member, bought from the house, or part of the capsule. */
  source: "owned" | "purchased" | "house";
  size?: string;
  costUsd?: number;
  wearCount: number;
  addedAt: number;
};

export type Look = {
  id: string;
  title: string;
  occasion?: string;
  slots: Partial<Record<Slot, string[]>>;
  source: "member" | "stylist";
  createdAt: number;
};

export type Drop = {
  id: string;
  title: string;
  subtitle: string;
  story: string;
  heroPieceId: string;
  state: "available" | "coming";
  opensAt?: number;
  minTier: MembershipTier;
  productIds: string[];
};

export type Preview = {
  id: string;
  lookId?: string;
  productId?: string;
  status: "queued" | "running" | "ready" | "failed";
  createdAt: number;
  /** The piece photograph stands in for the generated image until the pipeline is wired up. */
  posterPieceId: string;
};

export type BagLine = { productId: string; size: string; qty: number };

export type Order = {
  id: string;
  reference: string;
  status: "pending" | "processing" | "completed" | "cancelled";
  totalUsd: number;
  placedAt: number;
  lines: { productId: string; size: string; qty: number; priceUsd: number }[];
};

export const MEMBERSHIP_TIERS = ["client", "signature", "prestige", "circle_elite"] as const;
export type MembershipTier = (typeof MEMBERSHIP_TIERS)[number];

export const TIER_LABELS: Record<MembershipTier, string> = {
  client: "Client",
  signature: "Signature",
  prestige: "Prestige",
  circle_elite: "Circle Elite",
};

export const TIER_PRICE_USD: Record<MembershipTier, number> = {
  client: 0,
  signature: 549,
  prestige: 749,
  circle_elite: 949,
};

export const TIER_RANK: Record<MembershipTier, number> = {
  client: 0,
  signature: 1,
  prestige: 2,
  circle_elite: 3,
};

export const TIER_CLOTH: Record<MembershipTier, string> = {
  client: "—",
  signature: "Signature Nyoni Fabric",
  prestige: "Premium Nyoni Fabric",
  circle_elite: "The finest Nyoni Fabric",
};

export const TIER_BENEFITS: Record<MembershipTier, readonly string[]> = {
  client: ["The Nyoni capsule in your wardrobe", "Looks and styling from the Nyoni stylist", "Book a consultation"],
  signature: [
    "A made-to-measure suit each year in signature Nyoni Fabric",
    "Priority booking and fittings",
    "Complimentary alterations on your suits",
    "Atelier included",
    "Invitations to member events",
  ],
  prestige: [
    "A made-to-measure suit each year in premium Nyoni Fabric",
    "All Signature privileges",
    "Saved measurements and style profile",
    "Complimentary shipping and alterations",
    "Early access to new collections",
  ],
  circle_elite: [
    "A made-to-measure suit each year in the finest Nyoni Fabric",
    "All Prestige privileges",
    "Private fittings at your convenience",
    "Bespoke priority with limited slots",
    "Access to exclusive experiences",
  ],
};

export type Showroom = { id: string; city: string; address: string; phone: string; hours: string };

export type Appointment = {
  id: string;
  showroomId: string;
  kind: "fitting" | "alteration" | "consultation";
  requestedFor: number;
  status: "requested" | "confirmed" | "completed" | "cancelled";
  note?: string;
};

export const APPOINTMENT_LABELS: Record<Appointment["kind"], string> = {
  fitting: "Fitting",
  alteration: "Alteration",
  consultation: "Consultation",
};

export type SuitEntitlement = {
  year: number;
  status: "available" | "booked" | "in_progress" | "delivered";
  appointmentId?: string;
};

export type Wear = { id: string; wornOn: number; lookId?: string; pieceIds: string[] };

export type Conversation = { id: string; title: string; lastMessageAt: number; preview: string };

export type Message = {
  id: string;
  role: "member" | "advisor";
  body: string;
  at: number;
  /** A look the stylist put together, offered for the member to save. */
  proposedLook?: Look;
};
