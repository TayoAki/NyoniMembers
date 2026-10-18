import type { CatalogueEntryView } from "@convex/atelier/views";
import {
  CLOTH_PATTERN_LABELS,
  CLOTH_PATTERNS,
  CLOTH_WEIGHT_LABELS,
  CLOTH_WEIGHTS,
  OCCASION_LABELS,
  OCCASIONS,
  type ClothPattern,
  type ClothWeight,
  type Occasion,
} from "@convex/shared/atelier/enums";

/**
 * Pure helpers behind the cloth browser (S03): colour families read off the catalogue's colour word
 * (falling back to the representative shade), the filter shape and the matching itself. Nothing here
 * touches React or the server, so the result count is always the length of the list it describes.
 */

export const COLOUR_FAMILIES = ["navy_blue", "grey", "black", "brown", "green", "burgundy", "natural"] as const;
export type ColourFamily = (typeof COLOUR_FAMILIES)[number];
export const COLOUR_FAMILY_LABELS: Record<ColourFamily, string> = {
  navy_blue: "Navy and blue",
  grey: "Grey and charcoal",
  black: "Black",
  brown: "Brown and camel",
  green: "Green",
  burgundy: "Burgundy",
  natural: "Natural and stone",
};

/** The catalogue's colour word is the staff's own description, so it outranks the unconfirmed hex. */
const WORD_HINTS: readonly (readonly [RegExp, ColourFamily])[] = [
  [/\b(navy|blue|midnight|indigo)\b/, "navy_blue"],
  [/\b(black|onyx|ebony)\b/, "black"],
  [/\b(bordeaux|burgundy|wine|claret|oxblood)\b/, "burgundy"],
  [/\b(green|sage|olive|forest|moss)\b/, "green"],
  [/\b(brown|camel|tan|chocolate|tobacco|rust)\b/, "brown"],
  [/\b(stone|oatmeal|natural|sand|ivory|cream|beige|ecru)\b/, "natural"],
  [/\b(grey|gray|charcoal|steel|slate|oxford|silver)\b/, "grey"],
];

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, s, l };
}

function familyFromShade(hex: string): ColourFamily | null {
  const hsl = hexToHsl(hex);
  if (!hsl) return null;
  const { h, s, l } = hsl;
  if (l < 0.12) return "black";
  if (s < 0.1) return l > 0.6 ? "natural" : "grey";
  if (h >= 190 && h < 265) return "navy_blue";
  if (h >= 265 || h < 15) return "burgundy";
  if (h < 60) return l > 0.55 ? "natural" : "brown";
  return "green";
}

export function colourFamilies(cloth: Pick<CatalogueEntryView, "colour" | "hex">): ColourFamily[] {
  const word = cloth.colour.toLowerCase();
  const hits = WORD_HINTS.filter(([pattern]) => pattern.test(word)).map(([, family]) => family);
  if (hits.length > 0) return [...new Set(hits)];
  const fromShade = familyFromShade(cloth.hex);
  return fromShade ? [fromShade] : [];
}

export type ClothFilters = {
  query: string;
  colours: ColourFamily[];
  patterns: ClothPattern[];
  weights: ClothWeight[];
  occasions: Occasion[];
  inStockOnly: boolean;
};

export const DEFAULT_CLOTH_FILTERS: ClothFilters = {
  query: "",
  colours: [],
  patterns: [],
  weights: [],
  occasions: [],
  inStockOnly: false,
};

export function activeFilterCount(filters: ClothFilters): number {
  return (
    filters.colours.length +
    filters.patterns.length +
    filters.weights.length +
    filters.occasions.length +
    (filters.inStockOnly ? 1 : 0)
  );
}

export function hasActiveFilters(filters: ClothFilters): boolean {
  return activeFilterCount(filters) > 0 || filters.query.trim().length > 0;
}

export function matchesQuery(cloth: CatalogueEntryView, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;
  const haystack = [cloth.name, cloth.mill, cloth.composition, cloth.colour, cloth.code, cloth.supplierRef]
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .toLowerCase();
  return trimmed.split(/\s+/).every((term) => haystack.includes(term));
}

export function filterCloths(cloths: readonly CatalogueEntryView[], filters: ClothFilters): CatalogueEntryView[] {
  return cloths.filter((cloth) => {
    if (!matchesQuery(cloth, filters.query)) return false;
    if (filters.colours.length > 0 && !colourFamilies(cloth).some((family) => filters.colours.includes(family)))
      return false;
    if (filters.patterns.length > 0 && !filters.patterns.includes(cloth.pattern)) return false;
    if (filters.weights.length > 0 && (!cloth.weight || !filters.weights.includes(cloth.weight))) return false;
    if (filters.occasions.length > 0 && !cloth.occasions.some((occasion) => filters.occasions.includes(occasion)))
      return false;
    if (filters.inStockOnly && !cloth.inStock) return false;
    return true;
  });
}

export type FilterOptions = {
  colours: ColourFamily[];
  patterns: ClothPattern[];
  weights: ClothWeight[];
  occasions: Occasion[];
};

/** Only values the approved list actually carries become chips: a filter that can match nothing is noise. */
export function filterOptionsFor(cloths: readonly CatalogueEntryView[]): FilterOptions {
  const colours = new Set<ColourFamily>();
  const patterns = new Set<ClothPattern>();
  const weights = new Set<ClothWeight>();
  const occasions = new Set<Occasion>();
  for (const cloth of cloths) {
    for (const family of colourFamilies(cloth)) colours.add(family);
    patterns.add(cloth.pattern);
    if (cloth.weight) weights.add(cloth.weight);
    for (const occasion of cloth.occasions) occasions.add(occasion);
  }
  return {
    colours: COLOUR_FAMILIES.filter((family) => colours.has(family)),
    patterns: CLOTH_PATTERNS.filter((pattern) => patterns.has(pattern)),
    weights: CLOTH_WEIGHTS.filter((weight) => weights.has(weight)),
    occasions: OCCASIONS.filter((occasion) => occasions.has(occasion)),
  };
}

export type ActiveFilter = { key: string; label: string; without: ClothFilters };

/** The active filters as removable chips, for the toolbar and the no-results state. */
export function describeActiveFilters(filters: ClothFilters): ActiveFilter[] {
  const active: ActiveFilter[] = [];
  const query = filters.query.trim();
  if (query) active.push({ key: "query", label: `“${query}”`, without: { ...filters, query: "" } });
  for (const colour of filters.colours) {
    active.push({
      key: `colour:${colour}`,
      label: COLOUR_FAMILY_LABELS[colour],
      without: { ...filters, colours: filters.colours.filter((value) => value !== colour) },
    });
  }
  for (const pattern of filters.patterns) {
    active.push({
      key: `pattern:${pattern}`,
      label: CLOTH_PATTERN_LABELS[pattern],
      without: { ...filters, patterns: filters.patterns.filter((value) => value !== pattern) },
    });
  }
  for (const weight of filters.weights) {
    active.push({
      key: `weight:${weight}`,
      label: CLOTH_WEIGHT_LABELS[weight],
      without: { ...filters, weights: filters.weights.filter((value) => value !== weight) },
    });
  }
  for (const occasion of filters.occasions) {
    active.push({
      key: `occasion:${occasion}`,
      label: OCCASION_LABELS[occasion],
      without: { ...filters, occasions: filters.occasions.filter((value) => value !== occasion) },
    });
  }
  if (filters.inStockOnly)
    active.push({ key: "stock", label: "In stock", without: { ...filters, inStockOnly: false } });
  return active;
}

export function toggleValue<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

/**
 * Replacement suggestions for a cloth the house no longer offers or has run out of (C03): the same
 * pattern, preferring cloths that share the design's occasion, in stock and approved. Nothing is
 * chosen on the client's behalf.
 */
export function replacementsFor(
  cloths: readonly CatalogueEntryView[],
  {
    pattern,
    occasion,
    excludeCode,
    limit = 4,
  }: { pattern: ClothPattern; occasion?: Occasion; excludeCode: string; limit?: number },
): CatalogueEntryView[] {
  const pool = cloths.filter((cloth) => cloth.code !== excludeCode && cloth.inStock && cloth.status === "approved");
  const samePattern = pool.filter((cloth) => cloth.pattern === pattern);
  const sameOccasion = occasion ? samePattern.filter((cloth) => cloth.occasions.includes(occasion)) : samePattern;
  const rest = samePattern.filter((cloth) => !sameOccasion.includes(cloth));
  return [...sameOccasion, ...rest].slice(0, limit);
}
