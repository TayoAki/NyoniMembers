# Nyoni Members design direction

Quiet chrome, loud cloth. The dark theme is the house's own palette, verified from nyonicouture.com on
21 September 2026: `#080808` ground, `#F2ECDF` cream type, `#CAA663` gold as the single accent (buttons,
`--ring`, `--credit`), `#2F281A` brown for secondary surfaces, `#262626` hairlines, 4px radius. It is the
default theme. The light theme puts the same ink and gold on the house's cream. Garments supply every
other colour.
Display type is Bodoni Moda (`font-display`, used for page titles, the wordmark and garment names),
body type is Manrope, captions and measurements are IBM Plex Mono with 0.16em tracking. The wordmark
is "NYONI" with a tracked "Members" caption (`src/components/common/wordmark.tsx`). No gradients, no
icon circles, no metric cards; hairline rules divide sections. The front door (`src/app/page.tsx`) is
a single sign-in screen; marketing lives on nyonicouture.com. The section below is the Fitcheck base
direction this app inherits; where the two disagree, this section wins.

# Fitcheck base direction

Fitcheck is a personal wardrobe and styling studio, not an administration dashboard. The signed-in app uses a horizontal wordmark/navigation bar, a quiet off-white canvas (near-black in dark mode), strong tightly spaced typography, garment cutouts and full-length photographs. Design reference: Renson Gerald's AI Wardrobe Stylist case study on Dribbble. Borrow hierarchy and focus on clothes; do not reuse reference artwork or sustainability features.

- Use existing neutral semantic tokens. Clothing supplies colour. Status colours retain their meaning.
- Page headings: 34px mobile / 44px desktop, medium weight, -0.055em tracking. Section captions: 10px uppercase mono, 0.16em tracking. Main content: up to 1520px including 16/32/48px responsive gutters.
- Signature: viewfinder/check wordmark, fine divider lines, editorial captions, large garment imagery. Avoid decorative gradients, generic metric cards and repeated icon circles.
- Organize around tasks. Upload controls sit alongside scans. Saved outfits show a large selected render on the left and an always-visible compact grid of pieces/settings on the right; thumbnails switch the main image. Keep important controls above the fold. A styling brief and real wardrobe imagery share the studio screen. Settings are grouped by purpose with clear section navigation.
- One primary action per step. Secondary links stay quiet. Do not fill empty space with decorative cards or fake stats/content. Empty states explain the next useful step.
- Use shadcn/Base UI for accessible interaction primitives; customize composition. Never edit generated primitives for visual styling.
- Keep render images at 2:3 with object-contain: hair, feet and proportions must remain visible.
- Keep real loading, pending, partial, failure and completion states. Mobile layouts stack in task order with no page overflow. Respect reduced motion. Keyboard actions must remain accessible.

The horizontal shell intentionally supersedes the sidebar layout in the original PLAN.md; the current PLAN.md documents this shell, the global stylist and the scan/selection/import contract.

## Public landing page

The landing page has its own fashion editorial composition: Manrope display type, outlined headline accents, a layered campaign collage, a scroll-driven three-chapter wardrobe story, an interactive style study, open pricing columns and an oversized wordmark footer. Scope these styles to the landing page; the signed-in studio keeps its existing typography and functional density.

The user explicitly requested parallax. The public page therefore uses Motion scroll transforms and a native CSS sticky story, an intentional exception to the app's short layout-only motion convention. Never intercept wheel/touch scrolling. Mobile, short viewports and reduced-motion preferences get a normal stacked story with no extended sticky scrolling. All essential text and signup links remain visible without entrance-animation delays.

Campaign photos in `public/landing/` depict generated fictional adults. They are style inspiration, not customer results or private user uploads. Label illustrative previews accordingly. Use optimized Next Images and shared plan/credit constants; do not invent testimonials or usage metrics.

# The Atelier

The made-to-measure suit experience (`/atelier`, `docs/08-atelier-build-contract.md`) is the house's own
world, verified from nyonicouture.com on 18 October 2026, and it is built as a product, not a page: the
visitor is designing a suit, then asking the house to make it.

- **Palette and type are the house's.** Onyx `#080808` ground, cream `#F2ECDF` type, gold `#CAA663` as the
  single accent (primary action, selection, membership), brown `#2F281A` secondary surfaces, `#262626`
  hairlines, 0–4px radii, no shadows. Bodoni Moda for the one display line on a screen and for cloth
  names; Manrope for everything a person operates; IBM Plex Mono at 0.16em tracking for production
  codes, measurements, receipt numbers and dates in tables. The light theme is the same ink and gold on
  cream and has to look intended, not inverted.
- **Modes.** `/atelier` (the entry) is Persuade: one editorial statement, a studio look, a single primary
  action, and it may use the site's own gold-rule eyebrow once. Everything after it is Operate: no
  eyebrows, no cards nested in cards, no icon tiles, no gradients, no metric tiles, no decorative motion.
  Standard controls from `src/components/ui` everywhere; brand lives in type, palette, density and the
  signature move.
- **The signature move is the stage.** A large, calm figure drawn in hairlines (`SuitFigure`), filled live
  with the cloth's representative shade, beside a panel that reads like a tailor's order book: ruled rows,
  one decision per section, codes in mono at the end of the row. The figure is captioned "Studio
  illustration"; a personal preview is captioned "Illustrative preview — not a fitting". Neither pretends
  to be a photograph of the finished suit.
- **One authored motion:** the cloth crossfade on the stage, ≤250 ms, exponential ease-out, none under
  `prefers-reduced-motion`. Lists and panels otherwise appear in place.
- **Truthful states are design.** Save shows its scope ("Saved to this browser" / "Saved to your account");
  a request is "received", not "booked"; a quote accepted is not paid; shipped is not fitted; refund
  approved is not refunded; estimated dates carry the word "Estimate". The exact words are in
  `docs/08-atelier-build-contract.md` §6 and the enums' label maps; copy them, do not paraphrase.
- **Phones.** The stage becomes a sticky, collapsing header above the panel; the primary action is never
  under a fixed bar; 44px targets; one H1 per screen; `aria-live` for save and job status.
- **Staff surfaces** (`/admin/atelier/*`) are dense Operate screens: tables, filters, forms, the same
  vocabulary as the client sees, plus codes and provenance. Their job is to make the client's promises true.
