import type { ClothPattern } from "@convex/shared/atelier/enums";

/**
 * Colour helpers and SVG `<pattern>` definitions for the studio figure. Everything here is pure and
 * server-safe: the weave overlays are low-contrast lines in a lighter or darker mix of the cloth's own
 * shade, so a navy pinstripe reads as navy with a whisper of chalk, not as a navy suit wearing white rules.
 */

type Rgb = { r: number; g: number; b: number };

const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function parseHex(hex: string): Rgb | null {
  const match = HEX_PATTERN.exec(hex.trim());
  if (!match) return null;
  const raw =
    match[1].length === 3
      ? match[1]
          .split("")
          .map((c) => c + c)
          .join("")
      : match[1];
  const n = Number.parseInt(raw, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toHex({ r, g, b }: Rgb): string {
  const channel = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** Linear mix of two hex colours; `t` is how far to move from `from` toward `toward` (0–1). */
export function mixHex(from: string, toward: string, t: number): string {
  const a = parseHex(from);
  const b = parseHex(toward);
  if (!a || !b) return from;
  const k = Math.min(1, Math.max(0, t));
  return toHex({ r: a.r + (b.r - a.r) * k, g: a.g + (b.g - a.g) * k, b: a.b + (b.b - a.b) * k });
}

/** WCAG relative luminance, 0 (black) to 1 (white). Unparseable input counts as mid-grey. */
export function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0.5;
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
}

/** Ink for the weave overlays: lifted on dark cloths, deepened on light ones, always the cloth's own hue. */
export function patternInk(hex: string): string {
  return luminance(hex) < 0.28 ? mixHex(hex, "#FFFFFF", 0.4) : mixHex(hex, "#000000", 0.34);
}

/** Satin facings for the tuxedo: a deeper tonal shade; near-black cloth gets a slight lift so the facing still shows. */
export function satinTone(hex: string): string {
  return luminance(hex) < 0.025 ? mixHex(hex, "#FFFFFF", 0.14) : mixHex(hex, "#000000", 0.34);
}

/** WCAG contrast ratio between two colours, 1 (identical) to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * The ink for every stroke that lies on the cloth (edges, seams, pocket jets, buttons): the cloth's own hue
 * lifted or deepened by about half, whichever reads better against the shade, so a midnight navy's lapel
 * edge shows on cream and on onyx alike. Stronger than `patternInk` so a seam stays distinct from the weave.
 */
export function tonalEdge(hex: string): string {
  const lifted = mixHex(hex, "#FFFFFF", 0.5);
  const deepened = mixHex(hex, "#000000", 0.45);
  return contrastRatio(lifted, hex) >= contrastRatio(deepened, hex) ? lifted : deepened;
}

export function clothPatternId(prefix: string, pattern: ClothPattern): string {
  return `${prefix}-${pattern}`;
}

type DefProps = { id: string; pattern: ClothPattern; ink: string };

/**
 * One `<pattern>` per weave, in user units of the figure's 600×1000 viewBox. `solid` renders nothing.
 * Place inside `<defs>` and paint with `fill="url(#id)"` over the cloth piece.
 */
export function ClothPatternDef({ id, pattern, ink }: DefProps) {
  switch (pattern) {
    case "pinstripe":
      return (
        <pattern id={id} width="9" height="9" patternUnits="userSpaceOnUse">
          <path d="M0.6 0V9" stroke={ink} strokeWidth={0.8} strokeOpacity={0.75} />
        </pattern>
      );
    case "chalk_stripe":
      return (
        <pattern id={id} width="18" height="18" patternUnits="userSpaceOnUse">
          <path d="M1.2 0V18" stroke={ink} strokeWidth={2.2} strokeOpacity={0.32} />
        </pattern>
      );
    case "glen_check":
      return (
        <pattern id={id} width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M2 0V48M6 0V48M10 0V48M14 0V48M18 0V48M22 0V48" stroke={ink} strokeWidth={1} strokeOpacity={0.3} />
          <path d="M0 2H48M0 6H48M0 10H48M0 14H48M0 18H48M0 22H48" stroke={ink} strokeWidth={1} strokeOpacity={0.3} />
          <path d="M36 0V48M0 36H48" stroke={ink} strokeWidth={1.6} strokeOpacity={0.2} />
        </pattern>
      );
    case "plaid":
      return (
        <pattern id={id} width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M1.5 0V60M0 1.5H60" stroke={ink} strokeWidth={2.6} strokeOpacity={0.3} />
          <path d="M21 0V60M41 0V60M0 21H60M0 41H60" stroke={ink} strokeWidth={0.8} strokeOpacity={0.5} />
        </pattern>
      );
    case "herringbone":
      return (
        <pattern id={id} width="12" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 0L6 6L12 0" fill="none" stroke={ink} strokeWidth={0.9} strokeOpacity={0.5} />
        </pattern>
      );
    case "birdseye":
      return (
        <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="0.9" fill={ink} fillOpacity={0.6} />
          <circle cx="6" cy="6" r="0.9" fill={ink} fillOpacity={0.6} />
        </pattern>
      );
    case "jacquard":
      return (
        <pattern id={id} width="36" height="36" patternUnits="userSpaceOnUse">
          <path d="M18 0L36 18L18 36L0 18Z" fill="none" stroke={ink} strokeWidth={0.8} strokeOpacity={0.24} />
          <path d="M18 9L27 18L18 27L9 18Z" fill="none" stroke={ink} strokeWidth={0.6} strokeOpacity={0.16} />
        </pattern>
      );
    case "solid":
      return null;
  }
}
