# Nyoni Circle

The Expo app for iOS and Android, planned in [`docs/05-mobile-app-plan.md`](../docs/05-mobile-app-plan.md).
This is the front end only: every screen is built and navigable, backed by fixtures in `lib/`. No
Convex, no Clerk and no RevenueCat yet; those land in milestones M2, M4 and M7.

## Run it

Circle installs on its own, deliberately. It has its own `pnpm-workspace.yaml` so pnpm does not walk
up to the repository root, which would put the Expo dependency tree into the web app's lockfile and
into every Vercel build of the live site.

```bash
cd circle
pnpm install
pnpm exec expo start --dev-client
```

Native modules mean **Expo Go will not do**. Build a development client once per platform:

```bash
pnpm exec eas build --profile development --platform ios
pnpm exec eas build --profile development --platform android
```

## Seeing it without a device

`pnpm exec expo export --platform web` renders every route to static HTML, which is how the
screenshots in this repository were taken. It is a review aid, not a supported target: React Native
Web gets the layout right and tells you nothing about camera, push or purchase.

## What is fixture-backed

Everything. `lib/fixtures.ts` holds one invented member and her orders, appointments, wears and
conversations. The products, prices and photography are Nyoni Couture's own, copied from the web
app's capsule; the person is not real and neither are her transactions.

The state a member is in is switchable, because a screen is only right if it is right in every
state. Sign in, or open Settings, and choose between signed out, the fourteen-day Atelier preview,
free with the preview expired, an Atelier subscriber, and a Prestige member. Locked states, empty
states and allowances all follow from it.

## How access is decided

One function, `hasAtelier` in `lib/session.tsx`, mirrors the server function the plan describes:
you subscribed, your Circle membership includes it, or your preview is still running. Every gated
screen asks it and nothing else decides. When M7 lands, the fixture is replaced by a Convex query
and the screens do not change.

## The design system

It implements [`docs/06-frontend-style-guide.md`](../docs/06-frontend-style-guide.md). Four things
about it are worth knowing before changing a screen.

**The app is light with ink chrome.** Ivory pages carry the clothes; the header and the bottom
navigation are near-black; membership is the one dark page. There is no system light-or-dark
switch. A component asks `useSurface()` which surface it is sitting on, and `<Screen tone="dark">`
changes that for its subtree.

**Controls are square.** Three points of rounding on buttons and images, eight on inset cards,
sixteen on chat bubbles. The before/after switch and the chat composer are the only pills.

**Gold is for selection, membership and one special action.** Never small text on ivory, where it
sits at 1.74:1; `accentText` resolves to the darker gold ink there and to champagne on dark.

**Two faces.** Bodoni Moda for headings, Manrope for everything read as a task. The guide's Georgia
and Arial placeholders are not used, because the house's own faces are verified and available.

```
app/                 Expo Router routes, mirroring §8 of the style guide
components/ui/       Text, Button, Screen, BrandHeader, product, tabs, rows, states, editorial
components/stylist/  advisor badge, chat, outfit board
components/try-on/   preview stage, before/after control
components/circle/   membership card, clothier card
lib/theme.ts         the tokens: colours, surfaces, type scale, spacing, radii, ratios
lib/use-theme.tsx    which surface a component is on, and the responsive gutter
lib/session.tsx      who the member is and what they may reach
lib/fixtures.ts      the fictional world
assets/              the capsule photography
```

## Checks

```bash
pnpm exec tsc --noEmit                  # types, including generated route types
pnpm exec expo export --platform ios    # proves every import resolves
```

Route types are written into `.expo/types` by `expo start`, so run the dev server once before
relying on `tsc` to validate a `router.push` path.
