/**
 * The rest of the fixture world: one invented member and everything hanging off her. Nothing here is
 * a real person, a real order or a real appointment. Products live in `fixtures-products.ts`.
 */

import { products, productById } from "./fixtures-products";
import type {
  Appointment,
  BagLine,
  Conversation,
  Drop,
  Look,
  Message,
  Order,
  Piece,
  Preview,
  Showroom,
  SuitEntitlement,
  Wear,
} from "./types";

export { products, productById, productsByCategory } from "./fixtures-products";

const DAY = 86_400_000;
const now = Date.now();

export const member = {
  id: "member_fixture",
  name: "Marcus Adeyemi",
  email: "marcus@example.com",
  initials: "MA",
  homeShowroomId: "charlotte",
  memberSince: now - 400 * DAY,
  prefs: { fit: "tailored" as const, avoidColours: ["yellow"], homeCity: "Charlotte" },
};

export const showrooms: Showroom[] = [
  {
    id: "charlotte",
    city: "Charlotte",
    address: "The flagship showroom, Charlotte, North Carolina",
    phone: "(980) 237-2331",
    hours: "Tue to Sat, by appointment",
  },
  {
    id: "atlanta",
    city: "Atlanta",
    address: "The Atlanta showroom, Georgia",
    phone: "(404) 988-0728",
    hours: "Wed to Sat, by appointment",
  },
  {
    id: "houston",
    city: "Houston",
    address: "The Houston showroom, Texas",
    phone: "(832) 466-1113",
    hours: "Thu to Sat, by appointment",
  },
];

export function showroomById(id: string): Showroom | undefined {
  return showrooms.find((showroom) => showroom.id === id);
}

/** The capsule, already in the wardrobe, plus two garments the member photographed herself. */
export const pieces: Piece[] = [
  ...products.map<Piece>((product, index) => ({
    id: `piece_${product.id}`,
    productId: product.id,
    name: product.name,
    category: product.category,
    subcategory: product.subcategory,
    colour: product.colour,
    source: index < 3 ? "purchased" : "house",
    size: product.variations[0]?.size,
    costUsd: index < 3 ? product.priceUsd : undefined,
    wearCount: [9, 6, 4, 3, 3, 2, 2, 1, 1, 1][index] ?? 0,
    addedAt: now - (120 - index * 3) * DAY,
  })),
  {
    id: "piece_own_overcoat",
    name: "Camel wool overcoat",
    category: "outerwear",
    subcategory: "overcoat",
    colour: "camel",
    source: "owned",
    costUsd: 420,
    wearCount: 11,
    addedAt: now - 60 * DAY,
  },
  {
    id: "piece_own_chelsea",
    name: "Black suede Chelsea boots",
    category: "shoes",
    subcategory: "boots",
    colour: "black",
    source: "owned",
    costUsd: 310,
    wearCount: 22,
    addedAt: now - 45 * DAY,
  },
];

export function pieceById(id: string): Piece | undefined {
  return pieces.find((piece) => piece.id === id);
}

/** The photograph a piece shows. Owned garments have no house photography, so they fall back. */
export function piecePhotoKey(piece: Piece): string | undefined {
  return piece.productId;
}

export const looks: Look[] = [
  {
    id: "look_boardroom",
    title: "Monday, the boardroom",
    occasion: "Business",
    slots: {
      suit: ["piece_nyoni-grayson"],
      top: ["piece_nyoni-elna-blu"],
      shoes: ["piece_nyoni-oxford"],
      accessories: ["piece_nyoni-obinna", "piece_nyoni-silvano-2"],
    },
    source: "member",
    createdAt: now - 12 * DAY,
  },
  {
    id: "look_black_tie",
    title: "The Hendricks wedding",
    occasion: "Black tie",
    slots: {
      suit: ["piece_nyoni-opel-black-tux"],
      top: ["piece_nyoni-cavalera-formal"],
      shoes: ["piece_nyoni-oxford"],
      accessories: ["piece_nyoni-brittan-2"],
    },
    source: "stylist",
    createdAt: now - 5 * DAY,
  },
  {
    id: "look_saturday",
    title: "Saturday in town",
    occasion: "Smart casual",
    slots: {
      outerwear: ["piece_nyoni-cobalt-blazer-2"],
      top: ["piece_nyoni-navy-turtleneck"],
      bottom: ["piece_nyoni-taupe-flat-front-tailored-dress-pants"],
      shoes: ["piece_nyoni-florence-ii-penny-loafer"],
    },
    source: "member",
    createdAt: now - 2 * DAY,
  },
];

export function lookById(id: string): Look | undefined {
  return looks.find((look) => look.id === id);
}

export function lookPieceIds(look: Look): string[] {
  return Object.values(look.slots).flat();
}

export const drops: Drop[] = [
  {
    id: "drop_after_dark",
    title: "After dark",
    subtitle: "Selected by the house. Reserved for you.",
    story:
      "Evening asks for less, cut better. Six pieces for the dinners, the toasts and the rooms where the light is low and the tailoring does the talking.",
    heroPieceId: "nyoni-opel-black-tux",
    state: "available",
    minTier: "client",
    productIds: [
      "nyoni-opel-black-tux",
      "nyoni-cavalera-formal",
      "nyoni-brittan-2",
      "nyoni-oxford",
      "nyoni-silvano-2",
      "nyoni-sable-black-spread-collar-shirt",
    ],
  },
  {
    id: "drop_the_grey_hours",
    title: "The grey hours",
    subtitle: "Weekday tailoring in the house neutrals.",
    story:
      "Grey is the hardest neutral to get right and the easiest to live in once you have. Three cuts, one cloth family, built for the days that repeat.",
    heroPieceId: "nyoni-kijivu-suit",
    state: "available",
    minTier: "client",
    productIds: [
      "nyoni-kijivu-suit",
      "nyoni-grayson",
      "nyoni-cobalt-blazer-2",
      "nyoni-grey-overcoat",
      "nyoni-midnight-glen-plaid-pant",
    ],
  },
  {
    id: "drop_first_cut",
    title: "First cut",
    subtitle: "Prestige and above. Fourteen days before anyone else.",
    story:
      "The opening pieces of the new season, released to Prestige and Circle Elite first. Your clothier can hold a size before the drop opens to the house.",
    heroPieceId: "nyoni-isabella-bleu-pin-suit",
    state: "coming",
    opensAt: now + 9 * DAY,
    minTier: "prestige",
    productIds: ["nyoni-isabella-bleu-pin-suit", "nyoni-cascata-2", "nyoni-monaco-cap-toe"],
  },
];

export function dropById(id: string): Drop | undefined {
  return drops.find((drop) => drop.id === id);
}

export const previews: Preview[] = [
  {
    id: "preview_black_tie",
    lookId: "look_black_tie",
    status: "ready",
    createdAt: now - 4 * DAY,
    posterPieceId: "nyoni-opel-black-tux",
  },
  {
    id: "preview_boardroom",
    lookId: "look_boardroom",
    status: "ready",
    createdAt: now - 11 * DAY,
    posterPieceId: "nyoni-grayson",
  },
  {
    id: "preview_saturday",
    lookId: "look_saturday",
    status: "ready",
    createdAt: now - 1 * DAY,
    posterPieceId: "nyoni-cobalt-blazer-2",
  },
];

export function previewById(id: string): Preview | undefined {
  return previews.find((preview) => preview.id === id);
}

export const bag: BagLine[] = [
  { productId: "nyoni-cascata-2", size: "40R", qty: 1 },
  { productId: "nyoni-elna-blu", size: "16/34", qty: 2 },
];

export const orders: Order[] = [
  {
    id: "order_1",
    reference: "NC-10428",
    status: "completed",
    totalUsd: 1_480,
    placedAt: now - 38 * DAY,
    lines: [
      { productId: "nyoni-grayson", size: "40R", qty: 1, priceUsd: 895 },
      { productId: "nyoni-oxford", size: "10", qty: 1, priceUsd: 525 },
      { productId: "nyoni-silvano-2", size: "One size", qty: 1, priceUsd: 69 },
    ],
  },
  {
    id: "order_2",
    reference: "NC-10613",
    status: "processing",
    totalUsd: 149,
    placedAt: now - 3 * DAY,
    lines: [{ productId: "nyoni-elna-blu", size: "16/34", qty: 1, priceUsd: 149 }],
  },
];

export const appointments: Appointment[] = [
  {
    id: "appt_1",
    showroomId: "charlotte",
    kind: "fitting",
    requestedFor: now + 6 * DAY,
    status: "confirmed",
    note: "First fitting for the annual suit.",
  },
  {
    id: "appt_2",
    showroomId: "charlotte",
    kind: "alteration",
    requestedFor: now - 20 * DAY,
    status: "completed",
    note: "Trouser hem, charcoal three piece.",
  },
];

export const suitEntitlement: SuitEntitlement = {
  year: new Date().getFullYear(),
  status: "booked",
  appointmentId: "appt_1",
};

export const wears: Wear[] = [
  { id: "wear_1", wornOn: now - 1 * DAY, lookId: "look_saturday", pieceIds: [] },
  { id: "wear_2", wornOn: now - 3 * DAY, lookId: "look_boardroom", pieceIds: [] },
  { id: "wear_3", wornOn: now - 4 * DAY, pieceIds: ["piece_own_overcoat", "piece_nyoni-navy-turtleneck"] },
  { id: "wear_4", wornOn: now - 8 * DAY, lookId: "look_boardroom", pieceIds: [] },
  { id: "wear_5", wornOn: now - 10 * DAY, pieceIds: ["piece_own_chelsea"] },
  { id: "wear_6", wornOn: now + 4 * DAY, lookId: "look_black_tie", pieceIds: [] },
];

export const conversations: Conversation[] = [
  {
    id: "chat_wedding",
    title: "A black-tie wedding in October",
    lastMessageAt: now - 5 * DAY,
    preview: "Midnight tailoring, a crisp white shirt and your black oxfords.",
  },
  {
    id: "chat_travel",
    title: "Three days in New York",
    lastMessageAt: now - 21 * DAY,
    preview: "One suit, two shirts, the grey overcoat. Everything else follows from those.",
  },
];

export const messagesByConversation: Record<string, Message[]> = {
  chat_wedding: [
    {
      id: "m1",
      role: "member",
      body: "A black-tie wedding next month. Something with character, but I don't want to upstage anyone.",
      at: now - 5 * DAY - 3600_000,
    },
    {
      id: "m2",
      role: "advisor",
      body: "Then the Sovereign double-breasted tuxedo, which does the work without raising its voice. The classic tuxedo shirt underneath, the Brittan silk bow, and your black oxfords. I would leave the pocket square out entirely.",
      at: now - 5 * DAY - 3500_000,
      proposedLook: {
        id: "look_proposed_wedding",
        title: "The Hendricks wedding",
        occasion: "Black tie",
        slots: {
          suit: ["piece_nyoni-opel-black-tux"],
          top: ["piece_nyoni-cavalera-formal"],
          shoes: ["piece_nyoni-oxford"],
          accessories: ["piece_nyoni-brittan-2"],
        },
        source: "stylist",
        createdAt: now - 5 * DAY,
      },
    },
    {
      id: "m3",
      role: "member",
      body: "Saved. Can I see it on me before I commit?",
      at: now - 5 * DAY - 3400_000,
    },
    {
      id: "m4",
      role: "advisor",
      body: "You can. A preview shows you how the look reads, not how it will fit. Your clothier settles the fit at the showroom, and you have a fitting booked already.",
      at: now - 5 * DAY - 3300_000,
    },
  ],
  chat_travel: [
    {
      id: "m5",
      role: "member",
      body: "Three days in New York, two dinners and a client meeting. What do I pack?",
      at: now - 21 * DAY,
    },
    {
      id: "m6",
      role: "advisor",
      body: "The charcoal three piece carries the meeting and one dinner. The navy turtleneck under the blazer takes the second. Grey overcoat over everything, the penny loafers for the day, oxfords for the evening.",
      at: now - 21 * DAY + 60_000,
    },
  ],
};

/** Inspiration boards are an Atelier feature, so a free account sees this behind a locked state. */
export const boards = [
  { id: "board_evening", title: "Evening, considered", pieceIds: ["nyoni-opel-black-tux", "nyoni-brittan-2"] },
  {
    id: "board_neutrals",
    title: "The neutrals",
    pieceIds: ["nyoni-kijivu-suit", "nyoni-taupe-flat-front-tailored-dress-pants", "nyoni-grey-overcoat"],
  },
];

export const atelier = {
  monthlyUsd: 14.99,
  annualUsd: 99,
  previewDays: 14,
  features: [
    "Preview any look on your own photo",
    "Track what you wear with mirror selfies",
    "Your wardrobe analytics dashboard",
    "Enhanced flatlays and HD images",
    "Arrange your wardrobe your way",
    "Inspiration boards",
    "Styling from your clothier, in the app",
  ],
} as const;
