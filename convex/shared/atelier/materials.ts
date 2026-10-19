import { ATELIER_LIMITS } from "./enums";

/**
 * Buttons and linings the house offers on a commission. These are the cutter's standard range as
 * recorded on 18 October 2026 and are marked for confirmation (provenance below); like cloths they
 * live in `atelierCatalogueEntries` once seeded and staff approve, withdraw or add to them (O02).
 */
export type MaterialSeed = {
  code: string;
  name: string;
  description: string;
  colour: string;
  hex: string;
  supplierRef?: string;
  /** Which garments the material suits; empty means all. */
  garments: readonly ("two_piece" | "three_piece" | "tuxedo")[];
  sortOrder: number;
};

export const MATERIAL_PROVENANCE = "House standard range, recorded 18 October 2026; confirm with the cutter.";

export const BUTTON_SEED: readonly MaterialSeed[] = [
  {
    code: "btn-horn-dark",
    name: "Dark horn",
    description: "Natural buffalo horn, deep brown with movement in the grain.",
    colour: "dark brown",
    hex: "#3B2A1E",
    garments: [],
    sortOrder: 0,
  },
  {
    code: "btn-horn-smoke",
    name: "Smoke horn",
    description: "Grey-brown horn; quiet on charcoal and navy.",
    colour: "smoke",
    hex: "#5A534C",
    garments: [],
    sortOrder: 1,
  },
  {
    code: "btn-horn-light",
    name: "Light horn",
    description: "Honey-toned horn for lighter cloths.",
    colour: "honey",
    hex: "#A8814F",
    garments: [],
    sortOrder: 2,
  },
  {
    code: "btn-corozo-ivory",
    name: "Ivory corozo",
    description: "Vegetable ivory; matte, light and warm.",
    colour: "ivory",
    hex: "#E6DCC8",
    garments: [],
    sortOrder: 3,
  },
  {
    code: "btn-corozo-navy",
    name: "Navy corozo",
    description: "Dyed corozo, tonal on navy cloth.",
    colour: "navy",
    hex: "#1F2740",
    garments: [],
    sortOrder: 4,
  },
  {
    code: "btn-mop",
    name: "Mother of pearl",
    description: "Shell buttons with a soft lustre; summer tailoring.",
    colour: "pearl",
    hex: "#E9E4DA",
    garments: ["two_piece", "three_piece"],
    sortOrder: 5,
  },
  {
    code: "btn-satin-covered",
    name: "Satin-covered",
    description: "Buttons covered in the facing satin; the tuxedo standard.",
    colour: "black",
    hex: "#111113",
    garments: ["tuxedo"],
    sortOrder: 6,
  },
];

export const LINING_SEED: readonly MaterialSeed[] = [
  {
    code: "lin-bemberg-navy",
    name: "Navy Bemberg",
    description: "Cupro lining; breathable and cool against a shirt.",
    colour: "navy",
    hex: "#1B2340",
    garments: [],
    sortOrder: 0,
  },
  {
    code: "lin-bemberg-bordeaux",
    name: "Bordeaux Bemberg",
    description: "A deep red interior.",
    colour: "bordeaux",
    hex: "#5C1F2C",
    garments: [],
    sortOrder: 1,
  },
  {
    code: "lin-bemberg-forest",
    name: "Forest Bemberg",
    description: "A dark green interior.",
    colour: "forest",
    hex: "#1F3A2E",
    garments: [],
    sortOrder: 2,
  },
  {
    code: "lin-bemberg-gold",
    name: "Antique gold Bemberg",
    description: "The house's gold.",
    colour: "gold",
    hex: "#B8955A",
    garments: [],
    sortOrder: 3,
  },
  {
    code: "lin-bemberg-ivory",
    name: "Ivory Bemberg",
    description: "Light and quiet; summer cloths.",
    colour: "ivory",
    hex: "#EDE6D6",
    garments: [],
    sortOrder: 4,
  },
  {
    code: "lin-tonal",
    name: "Tonal to the cloth",
    description: "Matched to the suit cloth at the fitting.",
    colour: "tonal",
    hex: "#2F281A",
    garments: [],
    sortOrder: 5,
  },
  {
    code: "lin-paisley-black",
    name: "Black paisley jacquard",
    description: "A woven paisley in black on black; evening.",
    colour: "black",
    hex: "#17171A",
    garments: ["tuxedo", "two_piece", "three_piece"],
    sortOrder: 6,
  },
];

export const MONOGRAM_RULES = {
  maxChars: ATELIER_LIMITS.monogramMaxChars,
  pattern: /^[A-Z.]*$/,
  help: "Up to four capital letters, A to Z, with full stops if you like: N.S. or NCS.",
  /** The interior cannot be drawn on the closed jacket; the placement is reviewed on the real garment. */
  placementNote: "Monogram placement and thread are reviewed with you at the first fitting.",
} as const;

export function normalizeMonogramText(input: string): string {
  return input
    .toUpperCase()
    .replace(/\s+/g, "")
    .slice(0, MONOGRAM_RULES.maxChars + 4);
}
