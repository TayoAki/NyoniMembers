# Nyoni Circle — Frontend Style Guide

**Reference:** the supplied six-screen Nyoni Couture mobile mockup (`d5705b4f-40ff-44b6-91f7-b982234ac74c.png`, 1024 × 1536).  
**Audience:** frontend designers and developers.  
**Scope:** visual system, component specifications, screen composition, responsive adaptation, and interaction states.  
**Version:** 1.0 · 21 September 2026.

> **Implementation note, added when this was built.** `circle/` implements this guide. Two
> departures, both deliberate: the house's own typefaces are used rather than the Georgia and Arial
> placeholders, because Bodoni Moda and Manrope are verified from nyonicouture.com and recorded in
> `docs/01-brand-brief.md`; and the icon family is Ionicons' outline set at 24pt, which satisfies
> "one coherent family, 1.5–1.75px stroke" without hand-drawing nine glyphs. The desktop
> breakpoints in §5 are not built: Nyoni Circle is a phone app, and §5's mobile shell is what
> `components/ui/screen.tsx` and `app/(tabs)/_layout.tsx` implement.

## 1. Reference fidelity and implementation assumptions

Treat the supplied mockup as the visual direction. It shows six mobile screens in a presentation board: Home, Private drops, Fitting room, Stylist, Wardrobe, and Membership. The large logo above the board, board margins, outer panel frames, and concept footer are presentation elements; do not render them as app content.

**Observed:** black header and bottom navigation, warm ivory content surfaces, champagne accents, editorial serif titles, understated sans-serif UI, portrait photography, thin dividers, mostly square controls, and a dark membership screen.

**Proposed for implementation:** exact hex values, font stacks, spacing, component sizes, interaction behavior, and desktop breakpoints below. These are practical interpretations, not measurements from a source design file or an official Nyoni brand manual. The original font files, vector logo, and production photographs were not supplied.

Use a **390 CSS px mobile artboard** as the primary design baseline. The phone panels in the composite are reduced illustrations; do not copy their displayed pixel sizes into the interface.

## 2. Creative direction

Build a private fashion-house experience with a clear path to choosing a look, discovering a piece, or arranging service.

- Let tailoring and photography carry the visual richness.
- Use serif headings for personality and simple sans-serif text for tasks.
- Keep content deliberate: one dominant image or decision per section.
- Use gold to signal selection, membership, or a special action.
- Maintain precise alignment, consistent crops, and generous space around important content.
- Keep controls calm and predictable. Decorative effects should never compete with clothing.

Avoid bright gradients, purple AI accents, glowing buttons, glass panels, excessive shadows, oversized pill cards, and gamified credit dashboards. Do not add “luxury” through ornamental borders or gold everywhere.

## 3. Color system

The reference's dominant light surface is approximately `#F5F2EB`; its dark surfaces cluster around near-black. Use the following normalized palette consistently.

| Token               | Value     | Intended use                                               |
| ------------------- | --------- | ---------------------------------------------------------- |
| `--ny-ivory`        | `#F5F2EB` | Main light background; text on dark surfaces               |
| `--ny-ink`          | `#0C0C0B` | Main text, header, navigation, dark pages, primary buttons |
| `--ny-surface`      | `#E9E4DC` | Product wells, selected-item rows, quiet inset panels      |
| `--ny-paper`        | `#FCFAF6` | Stylist message bubbles; occasional elevated light surface |
| `--ny-muted`        | `#666158` | Secondary text on light surfaces                           |
| `--ny-line`         | `#D6D0C5` | Decorative dividers on light surfaces                      |
| `--ny-control-line` | `#8B8377` | Required boundaries of light inputs and outlined controls  |
| `--ny-dark-surface` | `#171715` | Dark inset surfaces and membership details                 |
| `--ny-dark-line`    | `#393630` | Decorative dividers on dark surfaces                       |
| `--ny-dark-muted`   | `#BDB5A8` | Secondary text on dark surfaces                            |
| `--ny-gold`         | `#D6B675` | Gold buttons with dark text; active navigation on black    |
| `--ny-gold-ink`     | `#795C2E` | Gold-toned text and focus outlines on ivory                |
| `--ny-chat-user`    | `#E2E1E6` | Subtle cool-gray user message bubble                       |
| `--ny-success`      | `#356347` | Success text/icon on light surfaces                        |
| `--ny-error`        | `#A53632` | Error text/icon on light surfaces                          |

**Color pairing rules**

- Ink on ivory is the default reading combination.
- Use ivory and muted ivory text on black; use champagne for selected icons or short accents.
- Champagne on ivory is too low contrast for small text. Use `--ny-gold-ink` for that role.
- Use ink text on champagne-filled buttons and the AI advisor badge.
- Borders separating decorative content may be subtle. Input boundaries and keyboard focus must remain clearly visible.
- Membership “Ready to begin” uses a gold dot plus explicit text. Status must never depend on color alone.

Calculated contrast for the proposed flat colors: ink/ivory **17.50:1**, muted/ivory **5.50:1**, gold/ink **10.07:1**, and gold-ink/ivory **5.55:1**. Gold/ivory is only **1.74:1**. These calculations do not validate text placed over photography.

## 4. Typography

Use the approved Nyoni typefaces when provided. Until then, use these **implementation placeholders**, which approximate the reference's serif/sans contrast:

```css
--ny-font-display: Georgia, "Times New Roman", serif;
--ny-font-ui: Arial, Helvetica, sans-serif;
```

Do not present these fonts as an identification of the mockup's original typefaces.

| Role                      | Mobile size / line height | Weight  | Treatment                       |
| ------------------------- | ------------------------- | ------- | ------------------------------- |
| Home hero title           | 44–52px / 0.98–1.04       | 400     | Serif; intentional short lines  |
| Page title                | 30–34px / 1.08–1.15       | 400     | Serif; slightly tight tracking  |
| Editorial card heading    | 26–32px / 1.1             | 400     | Serif; on-image or panel title  |
| Section title             | 22–26px / 1.15            | 400     | Serif                           |
| Body / chat               | 16px / 1.45–1.55          | 400     | Sans-serif                      |
| Product title             | 14–16px / 1.35            | 400–500 | Sans-serif; up to two lines     |
| Button / tab              | 14–16px / 1.2             | 500     | Sans-serif; sentence case       |
| Supporting caption        | 12px / 1.4                | 400     | Sans-serif                      |
| Eyebrow / ownership label | 11–12px / 1.3             | 500     | Uppercase; tracking 0.16–0.22em |
| Bottom-navigation label   | 12px / 1.2                | 400–500 | Sans-serif                      |

Display headings can use `letter-spacing: -0.025em`; do not tighten body text. Use uppercase only for small labels, membership-card lettering, and the logo. Long descriptions should remain below approximately 65 characters per line on desktop.

### Logo treatment

- Use an approved **NYONI / COUTURE** vector lockup, preserving its aspect ratio and original letter spacing.
- Header logo: approximately 136–152px wide in the 390px baseline; ivory on black.
- Keep at least 16px of clear space from neighboring UI.
- Use a single accessible name, “Nyoni Couture,” even if the artwork has two lines.
- Link the header logo to Home. The profile icon opens Membership/account.
- Until the vector arrives, use a clearly identified temporary text lockup; do not rebuild the final trademark with individually positioned characters.

## 5. Layout, spacing, and responsive behavior

### Mobile shell

| Element            | Specification                                                                    |
| ------------------ | -------------------------------------------------------------------------------- |
| Header             | 64px minimum content height plus top safe-area inset; black; thin bottom divider |
| Page gutters       | 16px at 320–374px; 20px at 375px and above                                       |
| Page title spacing | 20–24px below header; 6–8px between title and subtitle                           |
| Section spacing    | 24–32px; use 40px between major stories                                          |
| Product grid       | Two equal columns; 10–12px gap                                                   |
| Main button        | At least 44px high; 48px preferred; usually full width                           |
| Icon hit area      | At least 44 × 44px even when artwork is 20–24px                                  |
| Bottom navigation  | 68px minimum content height plus bottom safe-area inset                          |
| Border radius      | 2–4px for images/buttons; 8px for inset member cards; 16px for chat bubbles      |

Use a spacing scale of **4, 8, 12, 16, 20, 24, 32, 40, 48, 64px**. The fitting-room segmented switch and chat composer are the primary pill-shaped controls.

Keep the bottom navigation visible on normal mobile screens. Reserve its full height in the page layout so it cannot cover the last action. All pages can scroll; do not compress content to fit the mockup's panel height.

### Responsive rules — proposed extensions

| Width            | Layout                                                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 320–767px        | Mobile shell, bottom navigation, two-column products, vertically stacked actions                                                    |
| 768–1023px       | Wider content with controlled maximum widths; retain bottom navigation; use three product columns when imagery remains legible      |
| 1024px and above | Move the five destinations into the header; remove bottom navigation; use two-column task layouts and three or four product columns |

Desktop content maximum: **1200px**, centered, with 32–48px gutters. Form/chat text columns should generally remain within 640–720px.

- **Home:** editorial image and supporting membership/service content can share a two-column layout.
- **Drops:** lead with a wide editorial feature, followed by a three- or four-column product grid.
- **Fitting room:** image stage on the left, selection and actions on the right.
- **Stylist:** conversation on the left, current outfit on the right; keep each area's reading order logical.
- **Wardrobe:** filters/tabs above a responsive grid.
- **Membership:** member card and account summary beside benefits, appointments, and concierge.

At narrow widths or enlarged text, wrap headings, tabs, and actions gracefully. Allow horizontal scrolling only for a tab strip when necessary. Never introduce horizontal scrolling for the whole page.

## 6. Navigation

Preserve the five destinations and their order shown in the reference:

| Label    | Icon concept                      | Primary purpose                     |
| -------- | --------------------------------- | ----------------------------------- |
| Home     | House outline                     | Private edit and next member action |
| Drops    | Tag or diamond-tag outline        | Collections and member merchandise  |
| Try-on   | Four-corner framing mark          | Visual garment preview              |
| Stylist  | Person/bust                       | AI advisor and access to a clothier |
| Wardrobe | Wardrobe case / briefcase outline | Owned pieces and saved looks        |

Use one coherent SVG icon family with a 1.5–1.75px stroke at 24px. Avoid emoji icons. The reference's account control is a person inside a fine circle; keep that distinct from the Stylist destination through its placement and accessible label.

Inactive navigation uses ivory on black. Active navigation uses gold icon/text plus a short gold underline. Use `aria-current="page"` on the current destination; the underline ensures selection is not color-only.

Membership is accessed through the header profile icon and relevant Home card. It is **not a sixth bottom tab**. On the Membership route, no unrelated bottom destination should appear active.

## 7. Component specifications

### Buttons and text links

| Variant            | Appearance                                        | Use                                               |
| ------------------ | ------------------------------------------------- | ------------------------------------------------- |
| Primary on light   | Ink fill, ivory text, 2px radius                  | Shop this piece, Try this look, Style my wardrobe |
| Secondary on light | Transparent/ivory fill, 1px ink outline, ink text | Save look, Shop missing pieces                    |
| Primary on dark    | Ivory fill, ink text                              | Book your fitting                                 |
| Editorial gold     | Champagne fill, ink text                          | Home collection discovery                         |
| Text action        | Underlined label with optional right arrow        | View piece, Change, Speak to a clothier           |

Use 16–20px horizontal padding. Arrow icons are 16–20px with an 8px gap. Use links for navigation and buttons for state changes. Do not nest buttons inside an all-clickable card link.

Hover: subtle tone change or clearer underline. Pressed: slight fill change. Focus: visible 2px outline with 3px offset. Loading: keep width stable, announce progress, and prevent duplicate submission. Disabled: visually muted with a reason visible near the action when needed.

### Tabs and segmented controls

- Content tabs sit directly above a fine rule: active text is ink with a 2px underline; inactive text is muted.
- Drops: **Available now / Coming soon**.
- Wardrobe: **Owned / Saved looks / Saved to shop**.
- Use true tab semantics when switching panels in place: `tablist`, `tab`, `tabpanel`, arrow-key movement, and programmatic selection.
- The fitting-room **Original / Preview** control is a compact outlined pill with a black selected segment. Each segment must still be at least 44px high.
- Keep Original and Preview in the same image frame without a layout jump.

### Product cards

- Put photography inside a warm neutral image well with 2–4px corner rounding.
- Use consistent portrait ratios: **3:4** for modeled clothing; **1:1 or 4:5** for isolated wardrobe pieces.
- Set modeled images to `object-fit: cover` with a carefully selected focal point. Use `contain` for isolated products so shoes, sleeves, and garment edges are preserved.
- Place titles outside the image. Allow two lines before truncation.
- Drops may include an uppercase “Member access” label and a “View piece” link.
- Ownership labels distinguish **NYONI** from **YOU OWN** in the stylist outfit card.
- Do not insert mock prices, ratings, countdowns, or sale badges. Use verified product data when available.

### Editorial cards and photography

Use warm, low-key interiors, black tie and rich tailoring, burgundy and navy accents, natural skin tones, stone backgrounds, and close-ups of fabric or labels. Preserve the reference's representation of Black men in the principal editorial imagery.

Home photography should feel immersive; the Drops feature is a shorter landscape crop. Place real HTML headings and CTAs over the image. Use a dark gradient scrim behind text and verify contrast at all crops. Avoid baking interface text into photography.

Use supplied/licensed Nyoni assets for production. The reference's generated garments, membership card, and people are conceptual; do not imply they document actual stock, benefits, or staff. Avoid upscaling cropped thumbnails from the board as final assets.

### Selected garment row

Warm inset background; 48–56px thumbnail; garment name; “Change” action aligned at the end. Stack the action below the title at very narrow widths. Keep the thumbnail and garment title linked to the same product identity.

### Stylist messages and outfit board

- User bubble: aligned right, cool light gray, maximum 85% of conversation width.
- Advisor bubble: aligned left, warm white, maximum 85% width.
- Message padding: 12–16px; body type: 16px.
- Mark the advisor as **AI STYLE ADVISOR**, using a restrained gold badge with dark text.
- Keep **Speak to a clothier** visible near the title; distinguish AI responses from human responses.
- Outfit board: warm panel, centered serif title, garment imagery, product names and ownership labels; actions below the board.
- At 390px, three garment columns may fit. At narrow widths or enlarged text, stack or use two columns rather than shrinking labels.
- Composer: rounded outline, visible prompt, send icon with 44px hit area; expand for multiple lines.
- On software-keyboard opening, keep the composer above the keyboard and allow the conversation to scroll. Temporarily hide the mobile bottom navigation in this editing state if needed.

### Member card and service rows

- Membership card: dark leather-like texture, subtle border, gold lettering, approximately **1.8:1** aspect ratio.
- Render member tier and status as live text; texture is decorative. Avoid displaying actual identity or account data as a baked image.
- Membership page remains dark beneath the header.
- “Your annual suit” section combines heading, status text, fabric detail, and a wide ivory booking CTA.
- Service rows use thin dividers, 16px labels, a right arrow, and a minimum 48px height.
- Concierge card uses a small portrait beside short reassurance and a clear contact link. Use verified staff information.

## 8. Screen-by-screen composition

### Home

1. Black logo header and profile control.
2. Full-width editorial image beneath the header.
3. Small gold eyebrow: “WELCOME TO THE CIRCLE”.
4. Large ivory headline: “Style, on your terms.” Preserve its short, editorial line breaks where space permits.
5. Near the lower image edge: “The private edit” and gold “Discover the collection” CTA.
6. Compact annual-suit card with fabric thumbnail, serif title, and “Book your fitting” action.
7. Black bottom navigation with Home active.

Keep the hero text in normal layout or a resilient grid overlay. Never use fixed absolute coordinates that cause overlap when text wraps or the viewport shortens.

### Private drops

1. Ivory page; title “Private drops”.
2. Subtitle: “Selected by the house. Reserved for you.”
3. Availability tabs.
4. “After dark” editorial feature with an “Explore the edit” link.
5. Two-column product cards with image, name, member-access label, and link.
6. Drops active in navigation.

Coming-soon state should show actual release information if available. Avoid unsupported countdowns or scarcity claims.

### Fitting room

1. Title “Your fitting room”; subtitle “AI visual preview”.
2. Large portrait preview stage on stone/ivory background. Use **4:5** as an initial frame; `contain` the full person and garment.
3. Small caption: “Illustrative preview”.
4. Original / Preview segmented control.
5. Selected garment row with Change action.
6. Supporting copy: “Explore the look. Confirm fit with your clothier.”
7. Black “Shop this piece” CTA; outlined “Save look” beneath it.
8. Try-on active in navigation.

The mockup depicts a completed preview. Also design the upload, garment-selection, generating, failure, and unavailable states. Do not show a stock model as though it is the member's generated result.

### Stylist

1. Title “The Nyoni stylist”.
2. AI badge and human-service link.
3. Short conversation.
4. “Your evening, considered.” outfit board with distinct ownership labels.
5. Black “Try this look” and outlined “Shop missing pieces” actions.
6. Composer: “What are you dressing for?”
7. Stylist active in navigation.

The first-use state should offer useful occasion prompts and work before a full wardrobe upload. In a mixed owned/shop look, purchasing should include only eligible unowned items and remain reviewable before checkout.

### Wardrobe

1. Title “Your wardrobe” with “+ Add a piece” aligned alongside when space permits.
2. Subtitle: “Collected with intention.”
3. Owned / Saved looks / Saved to shop tabs.
4. Two-column grid of isolated pieces on neutral surfaces.
5. Black “Style my wardrobe” CTA below the content.
6. Wardrobe active in navigation.

Owned inventory and saved shopping items must be separate states. An item should not become owned merely because it was viewed or tried on.

### Membership

1. Dark page; ivory title “Your place in the Circle.”
2. Textured member card; “Prestige” is the reference's illustrative tier.
3. Annual-suit benefit, readable status, and fabric image.
4. Ivory “Book your fitting” CTA.
5. Rows: Your privileges, Appointments, Manage membership.
6. Clothier contact panel.
7. Persistent app navigation without falsely selecting another destination.

Populate tier, benefit status, and available services from actual entitlement data. The mockup supplies a layout, not new membership policy.

## 9. Required non-ideal states

| Context                      | Required presentation                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| First-use wardrobe           | Brief explanation, Add a piece action, optional eligible purchase import; no fake owned inventory |
| Empty saved looks            | “Your next look starts here.” with a stylist or collection route                                  |
| Loading products             | Stable image-ratio placeholders; minimal movement; no flashing white blocks                       |
| Image unavailable            | Neutral well and clear fallback label; retain title and available actions                         |
| Try-on processing            | Stable image stage, progress message, announced status; no invented percentage or completion time |
| Try-on failure               | Preserve input/selection, explain that the preview failed, offer Retry or Change photo            |
| AI styling failure           | Preserve the member's message; offer Retry and a clothier route where available                   |
| Sold-out item                | Visible status; disable purchase; offer a real available alternative or supported waitlist        |
| Saving a look                | Pending state, then “Saved”; if unsuccessful, restore the action and explain                      |
| Restricted member feature    | Explain eligibility and show the appropriate membership route; allow browsing where permitted     |
| Missing photo or fit profile | Ask only for the information needed for the current task                                          |
| Booking handoff              | Distinguish opening a booking service from a confirmed appointment                                |

Keep errors visually integrated: calm language, semantic text and icon, clear recovery. Never silently simulate AI generation, saved state, purchase, or booking success.

## 10. Motion and accessibility

- Use 120–180ms transitions for simple states and up to 240ms for drawers or dialogs.
- Keep movement limited to opacity and small translations. No continuous sparkle, floating products, or parallax.
- Respect reduced-motion preferences; disable decorative animation.
- Use at least 44px interactive targets and readable 16px form input text.
- Aim for at least 4.5:1 contrast for normal text and 3:1 for large text and essential control graphics; verify final combinations and image overlays.
- Use a visible keyboard focus indicator on both light and dark themes.
- Provide one H1 per screen and logical heading order.
- Label icon-only controls: “Open membership”, “Send message”, “Close”, and so on.
- Mark decorative texture and redundant icons as hidden from assistive technology.
- Give product photographs useful alt text; describe visual previews as generated previews, not proof of fit.
- Announce processing, errors, and save completion without moving focus unexpectedly.
- Manage focus inside dialogs and restore it to the triggering control when closed.
- Support enlarged text and 200% zoom without losing functionality or covering content with fixed bars.

## 11. Starter CSS tokens and shell

This is a framework-neutral starting point. Component behavior and final fonts still need implementation. Use semantic tokens instead of scattered literal colors.

```css
:root {
  --ny-ivory: #f5f2eb;
  --ny-ink: #0c0c0b;
  --ny-surface: #e9e4dc;
  --ny-paper: #fcfaf6;
  --ny-muted: #666158;
  --ny-line: #d6d0c5;
  --ny-control-line: #8b8377;
  --ny-dark-surface: #171715;
  --ny-dark-line: #393630;
  --ny-dark-muted: #bdb5a8;
  --ny-gold: #d6b675;
  --ny-gold-ink: #795c2e;
  --ny-chat-user: #e2e1e6;
  --ny-success: #356347;
  --ny-error: #a53632;
  --ny-font-display: Georgia, "Times New Roman", serif;
  --ny-font-ui: Arial, Helvetica, sans-serif;
  --ny-space-1: 4px;
  --ny-space-2: 8px;
  --ny-space-3: 12px;
  --ny-space-4: 16px;
  --ny-space-5: 20px;
  --ny-space-6: 24px;
  --ny-space-8: 32px;
  --ny-space-10: 40px;
  --ny-space-12: 48px;
  --ny-space-16: 64px;
  --ny-radius-sm: 3px;
  --ny-radius-card: 8px;
  --ny-radius-chat: 16px;
  --ny-gutter: 16px;
  --ny-content-max: 1200px;
  --ny-header-height: 64px;
  --ny-nav-height: 68px;
  --ny-ease: cubic-bezier(0.2, 0.7, 0.2, 1);
  --ny-fast: 140ms;
  --page-bg: var(--ny-ivory);
  --page-text: var(--ny-ink);
  --page-muted: var(--ny-muted);
  --page-line: var(--ny-line);
  --focus-color: var(--ny-gold-ink);
}

* {
  box-sizing: border-box;
}
body {
  margin: 0;
  background: var(--page-bg);
  color: var(--page-text);
  font: 400 1rem/1.5 var(--ny-font-ui);
}
button,
input,
textarea,
select {
  font: inherit;
}
img {
  display: block;
  max-width: 100%;
}
button,
a {
  -webkit-tap-highlight-color: transparent;
}
:focus-visible {
  outline: 2px solid var(--focus-color);
  outline-offset: 3px;
}
.theme-dark {
  --page-bg: var(--ny-ink);
  --page-text: var(--ny-ivory);
  --page-muted: var(--ny-dark-muted);
  --page-line: var(--ny-dark-line);
  --focus-color: var(--ny-gold);
  background: var(--page-bg);
  color: var(--page-text);
}
.app-shell {
  min-height: 100dvh;
  padding-bottom: calc(var(--ny-nav-height) + env(safe-area-inset-bottom));
}
.app-header {
  position: sticky;
  top: 0;
  z-index: 20;
  padding-top: env(safe-area-inset-top);
  border-bottom: 1px solid var(--ny-dark-line);
}
.app-header__inner {
  min-height: var(--ny-header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.container {
  width: 100%;
  max-width: var(--ny-content-max);
  margin-inline: auto;
  padding-inline: var(--ny-gutter);
}
.page {
  padding-block: 24px 32px;
}
.page-title {
  margin: 0;
  font: 400 clamp(1.875rem, 5vw, 2.125rem)/1.12 var(--ny-font-display);
  letter-spacing: -0.025em;
}
.page-subtitle {
  margin: 8px 0 0;
  color: var(--page-muted);
}
.product-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px 12px;
}
.product-media {
  aspect-ratio: 3 / 4;
  overflow: hidden;
  background: var(--ny-surface);
  border-radius: var(--ny-radius-sm);
}
.product-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.product-media--isolated img {
  object-fit: contain;
}
.button {
  min-height: 48px;
  padding: 12px 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: var(--ny-radius-sm);
  font-size: 0.9375rem;
  line-height: 1.3;
  text-align: center;
  text-decoration: none;
  cursor: pointer;
  transition: background-color var(--ny-fast) var(--ny-ease);
}
.button--primary {
  background: var(--ny-ink);
  color: var(--ny-ivory);
}
.button--secondary {
  background: transparent;
  color: var(--ny-ink);
  border-color: var(--ny-ink);
}
.button--ivory {
  background: var(--ny-ivory);
  color: var(--ny-ink);
}
.button--gold {
  background: var(--ny-gold);
  color: var(--ny-ink);
}
.button--block {
  width: 100%;
}
.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.icon-button {
  min-width: 44px;
  min-height: 44px;
}
.bottom-nav {
  position: fixed;
  inset: auto 0 0;
  z-index: 30;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  min-height: calc(var(--ny-nav-height) + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  border-top: 1px solid var(--ny-dark-line);
}
.bottom-nav a {
  min-height: var(--ny-nav-height);
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 4px;
  padding: 8px 2px;
  color: var(--ny-ivory);
  font-size: 0.75rem;
  line-height: 1.2;
  text-decoration: none;
}
.bottom-nav a[aria-current="page"] {
  color: var(--ny-gold);
}
.bottom-nav a::after {
  content: "";
  width: 28px;
  height: 2px;
  background: transparent;
}
.bottom-nav a[aria-current="page"]::after {
  background: currentColor;
}
.desktop-nav {
  display: none;
}
.desktop-nav a {
  color: var(--ny-ivory);
  text-decoration: none;
}
.desktop-nav a[aria-current="page"] {
  color: var(--ny-gold);
  text-decoration: underline;
  text-underline-offset: 8px;
}
@media (min-width: 375px) {
  :root {
    --ny-gutter: 20px;
  }
}
@media (min-width: 768px) {
  :root {
    --ny-gutter: 32px;
  }
  .product-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (min-width: 1024px) {
  :root {
    --ny-gutter: 40px;
  }
  .app-shell {
    padding-bottom: 0;
  }
  .bottom-nav {
    display: none;
  }
  .desktop-nav {
    display: flex;
    gap: 24px;
  }
  .product-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
@media (prefers-reduced-motion: reduce) {
  .button {
    transition: none;
  }
  .skeleton,
  .decorative-motion {
    animation: none;
  }
}
```

Apply `theme-dark` to the header, bottom navigation, Home dark areas, and Membership content. The header and bottom-nav classes assume this companion class supplies their black background and light focus color. Constrain drawers below full-screen modal layers; implement dialogs with an actual focus-managed modal, not a higher z-index alone.

## 12. Suggested component inventory

`AppShell`, `BrandHeader`, `PrimaryNavigation`, `PageHeading`, `EditorialHero`, `EditorialCard`, `BenefitCard`, `ProductCard`, `ProductGrid`, `ContentTabs`, `PreviewStage`, `BeforeAfterControl`, `SelectedGarmentRow`, `Button`, `TextAction`, `AdvisorBadge`, `ChatMessage`, `OutfitBoard`, `ChatComposer`, `MembershipCard`, `ServiceRow`, `ConciergeCard`, `EmptyState`, `InlineNotice`, `LoadingState`.

Separate appearance from business data. Components receive real product IDs, ownership, availability, member entitlements, and action callbacks. Provide explicit loading, empty, error, and disabled states. Use actual links for routes, not placeholder click handlers.

## 13. Asset handoff checklist

- Approved logo variants: ivory on dark and black on ivory.
- Approved brand font files, weights, and usage rights, or explicit acceptance of temporary font stacks.
- Home portrait with space for both top and lower text overlays.
- After-dark editorial image with mobile and desktop focal points.
- Consistent modeled product images and isolated wardrobe images.
- Fabric/label detail photography for member benefit cards.
- Optional subtle leather texture for the membership card.
- Verified clothier portrait and contact destination.
- Product names, IDs, prices if shown, stock states, and membership eligibility.
- Accessible image descriptions and clear distinction between real products and illustrative preview media.

## 14. Review and acceptance checklist

- [ ] All six screens preserve the reference's black/ivory/champagne hierarchy.
- [ ] Serif headings and sans-serif controls remain consistent.
- [ ] The final approved logo appears without distortion or recreated lettering.
- [ ] Mobile navigation has five destinations in the correct order.
- [ ] Active navigation and tabs have a shape/underline cue as well as color.
- [ ] Photography is aligned, correctly cropped, and free from embedded UI text.
- [ ] Product wells use warm neutral surfaces; no arbitrary white boxes or heavy shadows.
- [ ] Buttons and icon controls meet minimum touch sizes.
- [ ] All text remains readable at 320px width and enlarged text settings.
- [ ] Safe areas and the on-screen keyboard do not cover content or the composer.
- [ ] Try-on clearly identifies an illustrative visual preview and has real failure states.
- [ ] AI advisor and human clothier are distinguishable.
- [ ] Owned pieces and items available to buy remain distinct.
- [ ] Membership status and benefits are driven by confirmed data.
- [ ] Keyboard focus, tab behavior, modal focus, and status announcements work.
- [ ] Loading, empty, sold-out, unavailable, and error screens are designed.
- [ ] Desktop adapts the composition instead of enlarging a phone frame.
- [ ] No fake booking, checkout, saved-look, or generation success is shown.

**Handoff summary:** preserve the mockup's editorial fashion direction and implement it with reusable components, restrained styling, accurate content, and clear member actions.
