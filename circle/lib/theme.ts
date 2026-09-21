/**
 * The Nyoni Circle design system, implementing `docs/06-frontend-style-guide.md`.
 *
 * The app is light: ivory pages carrying the clothes, with ink chrome above and below them, and a
 * single dark page for membership. Gold signals selection, membership or a special action, and is
 * never used as small text on ivory because the contrast does not hold.
 */

/** The raw palette. Screens read `surfaces` instead; these are the values behind it. */
export const ny = {
  ivory: "#F5F2EB",
  ink: "#0C0C0B",
  surface: "#E9E4DC",
  paper: "#FCFAF6",
  muted: "#666158",
  line: "#D6D0C5",
  controlLine: "#8B8377",
  darkSurface: "#171715",
  darkLine: "#393630",
  darkMuted: "#BDB5A8",
  gold: "#D6B675",
  goldInk: "#795C2E",
  chatUser: "#E2E1E6",
  success: "#356347",
  error: "#A53632",
} as const;

export type SurfaceTone = "light" | "dark";

export type Surface = {
  background: string;
  text: string;
  muted: string;
  /** Decorative dividers. Never the boundary of a control. */
  line: string;
  /** Required boundaries of inputs and outlined controls, which must stay visible. */
  controlLine: string;
  /** Product wells, quiet inset panels, selected rows. */
  well: string;
  /** An elevated light surface, such as an advisor message. */
  raised: string;
  /** Gold that is legible as text on this surface. */
  accentText: string;
  /** Gold used as a fill or an icon on this surface. */
  accent: string;
  focus: string;
  success: string;
  error: string;
};

export const surfaces: Record<SurfaceTone, Surface> = {
  light: {
    background: ny.ivory,
    text: ny.ink,
    muted: ny.muted,
    line: ny.line,
    controlLine: ny.controlLine,
    well: ny.surface,
    raised: ny.paper,
    // Champagne on ivory is 1.74:1, so gold-toned text on light uses the darker gold ink.
    accentText: ny.goldInk,
    accent: ny.gold,
    focus: ny.goldInk,
    success: ny.success,
    error: ny.error,
  },
  dark: {
    background: ny.ink,
    text: ny.ivory,
    muted: ny.darkMuted,
    line: ny.darkLine,
    controlLine: ny.darkMuted,
    well: ny.darkSurface,
    raised: ny.darkSurface,
    accentText: ny.gold,
    accent: ny.gold,
    focus: ny.gold,
    success: "#7FB894",
    error: "#E08C88",
  },
};

/** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Nothing in between. */
export const space = {
  x1: 4,
  x2: 8,
  x3: 12,
  x4: 16,
  x5: 20,
  x6: 24,
  x8: 32,
  x10: 40,
  x12: 48,
  x16: 64,
} as const;

/** Controls are square. Only the before/after switch and the chat composer are pills. */
export const radius = { sm: 3, card: 8, chat: 16, pill: 999 } as const;

export const chrome = {
  headerHeight: 64,
  navHeight: 68,
  /** 16 below 375pt, 20 at 375 and above. `useGutter()` resolves it. */
  gutterNarrow: 16,
  gutterWide: 20,
  tapTarget: 44,
  buttonHeight: 48,
} as const;

/**
 * Two faces doing two jobs: Bodoni Moda for personality, Manrope for tasks. Both are the house's
 * own, taken from nyonicouture.com, so the guide's placeholder stack is not needed.
 */
export const fontFamily = {
  display: "BodoniModa_400Regular",
  displayMedium: "BodoniModa_500Medium",
  displayItalic: "BodoniModa_400Regular_Italic",
  ui: "Manrope_400Regular",
  uiMedium: "Manrope_500Medium",
  uiSemi: "Manrope_600SemiBold",
} as const;

export type TypeVariant =
  | "hero"
  | "pageTitle"
  | "editorial"
  | "section"
  | "body"
  | "productTitle"
  | "button"
  | "caption"
  | "eyebrow"
  | "navLabel";

type TypeStyle = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
  textTransform?: "uppercase";
};

/**
 * Display sizes carry -0.025em of tracking, expressed here in points because React Native has no
 * em unit. Body text is never tightened.
 */
export const typography: Record<TypeVariant, TypeStyle> = {
  hero: { fontFamily: fontFamily.display, fontSize: 46, lineHeight: 47, letterSpacing: -1.15 },
  pageTitle: { fontFamily: fontFamily.display, fontSize: 32, lineHeight: 36, letterSpacing: -0.8 },
  editorial: { fontFamily: fontFamily.display, fontSize: 28, lineHeight: 31, letterSpacing: -0.7 },
  section: { fontFamily: fontFamily.display, fontSize: 23, lineHeight: 27, letterSpacing: -0.4 },
  body: { fontFamily: fontFamily.ui, fontSize: 16, lineHeight: 24 },
  productTitle: { fontFamily: fontFamily.ui, fontSize: 15, lineHeight: 20 },
  button: { fontFamily: fontFamily.uiMedium, fontSize: 15, lineHeight: 18 },
  caption: { fontFamily: fontFamily.ui, fontSize: 12, lineHeight: 17 },
  eyebrow: {
    fontFamily: fontFamily.uiMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  navLabel: { fontFamily: fontFamily.uiMedium, fontSize: 12, lineHeight: 14 },
};

/** Modelled clothing is 3:4. Isolated pieces are 4:5. The preview stage is 4:5. */
export const ratio = { modelled: 3 / 4, isolated: 4 / 5, feature: 16 / 10, memberCard: 1.8 } as const;

/** 120–180ms for simple states, up to 240ms for anything that opens. */
export const motion = { fast: 140, base: 180, overlay: 240 } as const;
