/**
 * The house design system, ported from the values verified off nyonicouture.com and recorded in
 * docs/01-brand-brief.md. Dark is the default: the app is onyx with cream editorial panels and a
 * single brass accent. Product photography is shot on a light studio background, so it sits on a
 * cream tile in dark mode rather than floating on black.
 */

export type ColourScheme = "dark" | "light";

export type Palette = {
  background: string;
  surface: string;
  surfaceRaised: string;
  /** Product and preview photography always sits on this, in both schemes. */
  photo: string;
  foreground: string;
  muted: string;
  primary: string;
  onPrimary: string;
  border: string;
  borderStrong: string;
  success: string;
  warning: string;
  danger: string;
  /** Marks anything only an Atelier subscriber can reach. */
  locked: string;
};

const dark: Palette = {
  background: "#080808",
  surface: "#141414",
  surfaceRaised: "#1C1C1C",
  photo: "#F2ECDF",
  foreground: "#F2ECDF",
  muted: "#A8A49B",
  primary: "#CAA663",
  onPrimary: "#080808",
  border: "#262626",
  borderStrong: "#3A3A3A",
  success: "#6FBF8B",
  warning: "#D9A441",
  danger: "#D9605A",
  locked: "#CAA663",
};

const light: Palette = {
  background: "#F2ECDF",
  surface: "#F7F3EA",
  surfaceRaised: "#FFFFFF",
  photo: "#FFFFFF",
  foreground: "#080808",
  muted: "#6B665C",
  primary: "#080808",
  onPrimary: "#F2ECDF",
  border: "#D8D0BE",
  borderStrong: "#B9AF98",
  success: "#2F6D45",
  warning: "#8A6414",
  danger: "#8E2F2A",
  locked: "#2F281A",
};

export const palettes: Record<ColourScheme, Palette> = { dark, light };

/** 4pt rhythm. `gutter` is the side margin every screen keeps on a phone. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  gutter: 16,
} as const;

export const radius = { sm: 4, md: 8, lg: 14, pill: 999 } as const;

/**
 * Three faces, each with one job: Bodoni Moda for display, Manrope for everything read as prose,
 * IBM Plex Mono for the small uppercase eyebrows that carry the house's editorial voice.
 */
export const fontFamily = {
  display: "BodoniModa_500Medium",
  displayItalic: "BodoniModa_400Regular_Italic",
  body: "Manrope_400Regular",
  bodyMedium: "Manrope_500Medium",
  bodySemi: "Manrope_600SemiBold",
  mono: "IBMPlexMono_400Regular",
} as const;

export type TypeVariant =
  "display" | "title" | "heading" | "subheading" | "body" | "bodySmall" | "label" | "eyebrow" | "price";

export const typography: Record<
  TypeVariant,
  { fontFamily: string; fontSize: number; lineHeight: number; letterSpacing?: number; textTransform?: "uppercase" }
> = {
  display: { fontFamily: fontFamily.display, fontSize: 40, lineHeight: 42, letterSpacing: -0.8 },
  title: { fontFamily: fontFamily.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.4 },
  heading: { fontFamily: fontFamily.display, fontSize: 21, lineHeight: 26, letterSpacing: -0.2 },
  subheading: { fontFamily: fontFamily.bodySemi, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fontFamily.body, fontSize: 16, lineHeight: 24 },
  bodySmall: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: fontFamily.bodyMedium, fontSize: 14, lineHeight: 18 },
  eyebrow: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  price: { fontFamily: fontFamily.bodySemi, fontSize: 16, lineHeight: 20 },
};

/** Product and preview imagery is 4:5 portrait everywhere. */
export const ratio = { portrait: 4 / 5, hero: 3 / 4, wide: 16 / 9 } as const;

/** Apple asks for 44pt; nothing tappable in this app is smaller. */
export const hitSize = { min: 44 } as const;

/** Motion stays under 250ms and is skipped entirely when the system asks for reduced motion. */
export const motion = { fast: 120, base: 200, slow: 250 } as const;
