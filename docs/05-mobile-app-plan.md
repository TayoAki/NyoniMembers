# Nyoni Circle — the mobile app plan

The master plan for rebuilding Nyoni Members as an Expo mobile app called **Nyoni Circle**. It covers
what the product is, what already exists, what has to be built, in what order, and how each step is
proved. Read it before opening an editor. Everything here is a decision record, not code.

**Status: proposed, 21 September 2026.** Nothing in this plan has been built. The existing web app
(`README.md`) is live and keeps running while this is built. Where a fact was verified against a
source on 21 September 2026, the source is named; where a choice is still open, it is listed in
§5 with a recommended default and the evidence that would settle it.

---

## 0. How to read this

| Section          | Answers                                                        |
| ---------------- | -------------------------------------------------------------- |
| §1 The product   | What Nyoni Circle is and who it is for                         |
| §2 What exists   | Which two thirds of this app are already written               |
| §3 Architecture  | How the phone, Convex, the agent and WooCommerce fit together  |
| §4 Stack         | Exact packages, verified versions, and what to re-check        |
| §5 Decisions     | Six choices to make before any code, with recommendations      |
| §6 Screens       | Navigation map, every screen, every state                      |
| §7 Design        | The house design system expressed in React Native              |
| §8 Data          | New Convex tables and how they relate to what exists           |
| §9 Access        | Who may do what, and where that is enforced                    |
| §10 Build order  | Ten phases, each a thin working slice with acceptance criteria |
| §11 Verification | What "done" means and the evidence that proves it              |
| §12 Measurement  | The events worth counting and their denominators               |
| §13 Risks        | What could sink a phase, and the cheap way to find out early   |
| §14 Not in v1    | What we are deliberately leaving out                           |
| §15 Appendix     | Repo layout, commands, and the skills that run each phase      |

The concept design this plan implements is at `docs/assets/mobile-concept.webp`. It is a visual
reference for tone and layout, not a source of measurements or final copy (§7).

### The skills that run this plan

Five skills are installed at `.claude/skills/`. Each phase in §10 names the one that runs it.

| Skill                        | Runs                                                    |
| ---------------------------- | ------------------------------------------------------- |
| `mobile-plan-mvp`            | This document, and any re-scoping of it                 |
| `mobile-design-flows`        | Phase 1 screen specs and design references              |
| `mobile-auth-access`         | Phase 2 identity, sessions, roles, account deletion     |
| `mobile-backend-memberships` | Phases 8–9 entitlements, commerce, purchase state       |
| `mobile-build-verify`        | Every feature phase: build one slice, prove it, move on |

They carry a worked fitness-marketplace example from the tutorial they were adapted from. That
example is not this product. Where it conflicts with this plan, this plan wins.

---

## 1. The product

**Nyoni Circle is a private membership app that brings Nyoni Couture's shopping, styling and personal
service into one place.**

A member can:

- Shop exclusive drops and get early access to selected collections.
- Virtually try on pieces using their own photo before buying.
- Get styling advice for weddings, business, travel and everyday occasions.
- Build a personal wardrobe that mixes what they already own with what they buy from the house.
- Save complete looks and shop the pieces they are missing.
- See their membership benefits, including the annual suit entitlement and priority fittings.
- Reach a human clothier for appointments, alterations and personal assistance.

**The core journey, and the thing every phase serves:**

> discover a piece → style it → preview it on yourself → purchase or book a fitting → save it to your wardrobe

**The purpose:** help members dress with confidence, make better purchase decisions, and get more out
of their relationship with the house.

**The promise we must never overstate.** A virtual try-on previews _appearance_. A clothier confirms
_fit_. Every preview surface says so, in the interface and not only in a policy page. This is both an
honesty requirement and the reason the app drives toward a fitting rather than away from one.

**Who it is for.** Existing and prospective members of The Nyoni Circle: men who buy made-to-measure,
in or near Charlotte, Atlanta and Houston, plus remote members who visit for fittings. Membership
tiers, prices and benefits are already fixed by the house and recorded in
`convex/shared/membership.ts`: Client (no fee), Signature US$549/year, Prestige US$749/year, Circle
Elite US$949/year by invitation.

**What it is not.** It is not a public storefront, not a social network, and not a replacement for
nyonicouture.com. It is the members' door.

---

## 2. What already exists

This is a **front-end rebuild, not a rewrite**. The current repository is a Next.js 16 web app on a
Convex backend, live at the URL in `README.md`. The backend, the AI pipeline and the agent are
platform-independent and transfer whole.

### Transfers unchanged

| Area                | Where                                                 | What it gives the mobile app                                                                                                 |
| ------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Data and auth       | `convex/schema.ts`, `convex/lib/auth.ts`              | 15 tables, `requireUser`/`requireAdmin`/`assertOwner`, per-user scoping on every function                                    |
| Wardrobe            | `convex/items.ts`, `convex/model/items.ts`            | Items with attributes, search text, vector embeddings, categories and slots (`convex/shared/wardrobe.ts`, suits first class) |
| Ingest pipeline     | `convex/workflows/ingest.ts`, `convex/ai/*`           | Photo → detected garments → extracted cut-outs → wardrobe items, with a durable job and step progress                        |
| Try-on pipeline     | `convex/renders.ts`, `convex/workflows/`              | Outfit + member photo → generated preview image, share tokens, regenerate, delete                                            |
| Looks               | `convex/outfits.ts`, `convex/model/outfits.ts`        | Outfit slots with validation, including the suit slot layering rules                                                         |
| The capsule         | `convex/shared/collection.ts`, `convex/collection.ts` | 22 curated Nyoni pieces seeded into every wardrobe, with product links and photos                                            |
| Membership          | `convex/shared/membership.ts`, `convex/admin.ts`      | Tiers, statuses, benefits, prices, cloth grades, staff-set status by email                                                   |
| House facts         | `convex/shared/house.ts`                              | Concierge email and SMS, three showrooms with phone numbers and hours                                                        |
| The concierge agent | `agent/` (Eve 0.56)                                   | Persona, wardrobe tools, outfit composition, preview quoting and approval, gap analysis                                      |
| Jobs and progress   | `convex/model/jobs.ts`                                | Truthful multi-step progress for anything slow                                                                               |
| Accounting          | `convex/model/credits.ts`                             | The only writer of balances and the ledger; becomes the internal meter behind the tier allowance (§5, D2)                    |

### Rebuilt for native

Everything under `src/` is web. The screens, the shadcn/Base UI component layer, Tailwind, theming,
drag-and-drop upload and the browser chat surface are all replaced. Roughly 60 components. The
_specifications_ transfer; the implementations do not.

### New, and not in the web app at all

These are the reason this is a new product and not a port:

1. **Drops and shopping.** The web app has a wardrobe, not a shop. Product catalogue, sizes, stock,
   product detail, and the curated drop edits in the concept design are all new.
2. **Purchase.** No checkout exists today. §5 D1 decides how it works.
3. **Appointments.** Booking a fitting, an alteration or a consultation at a showroom.
4. **The clothier channel.** A human handoff with a stated response time, distinct from the AI.
5. **The annual suit entitlement.** Each membership tier includes one made-to-measure suit a year;
   nothing tracks that today.
6. **Shop the missing pieces.** A saved look knows which pieces the member owns and which are for
   sale. Partially possible today because capsule items carry a `collectionKey`, but not surfaced.
7. **Native capture.** Camera, photo library, permissions, and a decent full-body photo flow.
8. **Push notifications.** Drop opens, preview ready, fitting reminders.

---

## 3. The architecture

```
                    ┌─────────────────────────────┐
                    │      Nyoni Circle (Expo)    │
                    │  iOS · Android · dev build  │
                    └──────┬───────┬───────┬──────┘
                           │       │       │
        Clerk session JWT  │       │       │  authorized browser session
        (audience: convex) │       │       │
                           ▼       │       ▼
              ┌──────────────────┐ │  ┌──────────────────────┐
              │      Convex      │ │  │  WooCommerce checkout │
              │  data · storage  │ │  │   nyonicouture.com    │
              │  jobs · AI calls │ │  └──────────┬───────────┘
              └────────┬─────────┘ │             │ order webhook
                       │           │             ▼
                       │           │  ┌──────────────────────┐
                       │           └─▶│  Next.js deployment  │
                       │              │  /eve/v1 agent host  │
                       │◀─────────────│  staff console       │
                       │  service key │  public share pages  │
                       ▼              └──────────────────────┘
              ┌──────────────────┐
              │  OpenAI via the  │
              │   AI Gateway     │
              └──────────────────┘
```

**Four decisions are embedded in that diagram.**

1. **Convex stays the backend.** The phone talks to it directly with the same authenticated functions
   the web app uses. No REST layer in between, no second source of truth, and the realtime queries
   that make job progress truthful work the same on device.

2. **The existing Next.js deployment is kept and repurposed.** It already hosts the concierge agent at
   `/eve/v1/*` through `withEve(nextConfig)` in `next.config.ts`. Killing it would mean rehosting the
   agent for no gain. It keeps three jobs: agent host, staff console, and the public share pages that
   a shared preview link opens. It stops being the member's front door.

3. **WooCommerce stays the commerce system of record.** The house already sells memberships there as
   products (checkout ids 19172–19174, per `docs/01-brand-brief.md`) and runs 775 products with
   stock and variations. Convex holds a synced, read-only projection for browsing; money is taken by
   WooCommerce (§5 D1, D3).

4. **The phone never holds a privileged key.** Clerk gives it a session JWT; Convex derives the user
   from that. The agent service key, the Clerk secret and the AI key stay server-side, exactly as
   they do today.

---

## 4. The stack

Verified against official sources on 21 September 2026. **Re-verify before Phase 0 begins**; the
skills require it and these move fast.

| Layer          | Choice                                                                               | Version seen 21 Sep 2026                                                | Source                                                                                    |
| -------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| App runtime    | Expo SDK                                                                             | 57 stable (57.0.24); SDK 58 in beta since 15 Sep with React Native 0.88 | [expo.dev/changelog](https://expo.dev/changelog)                                          |
| React Native   | via Expo 57                                                                          | 0.86                                                                    | [expo.dev/changelog](https://expo.dev/changelog)                                          |
| Navigation     | Expo Router                                                                          | ships with SDK                                                          | [docs.expo.dev](https://docs.expo.dev/)                                                   |
| Identity       | `@clerk/expo` with `tokenCache` from `@clerk/expo/token-cache` + `expo-secure-store` | current                                                                 | [clerk.com/docs/expo](https://clerk.com/docs/expo/getting-started/quickstart)             |
| Backend client | `convex` → `ConvexReactClient` + `ConvexProvider`                                    | same library as web                                                     | [docs.convex.dev](https://docs.convex.dev/quickstart/react-native)                        |
| Streaming HTTP | `expo/fetch` (WinterCG fetch with real `ReadableStream`)                             | SDK 57                                                                  | [docs.expo.dev/versions/latest/sdk/expo](https://docs.expo.dev/versions/latest/sdk/expo/) |
| Agent          | `eve` 0.56 `Client` from `eve/client`                                                | installed                                                               | `node_modules/eve/docs/guides/client/overview.mdx`                                        |
| Builds         | EAS Build + EAS Submit, development build required                                   | current                                                                 | [docs.expo.dev](https://docs.expo.dev/)                                                   |

**Pin SDK 57.** SDK 58 is in beta and React Native 0.88 is a release candidate. Starting a new product
on a beta runtime buys nothing and costs a week the first time a native module lags.

**A development build is required, not Expo Go.** Clerk's native `<AuthView />` components cannot run
in Expo Go; only hosted auth and custom flows can. Native Apple and Google sign-in need credential
setup, environment variables and an iOS URL scheme. Plan for `eas build --profile development` from
day one.

**Two facts that shape Phase 0.** First, React Native's default `fetch` cannot stream a response body,
and the concierge is a streaming NDJSON chat. `expo/fetch` fixes that, but `eve` 0.56's `ClientOptions`
exposes `host`, `auth`, `headers` and `redirect` and **no fetch injection point**, so the app must
either install `expo/fetch` as the global fetch or write a thin transport against the documented
session protocol. Prove this before designing the stylist screen. Second, `useEveAgent` from
`eve/react` is documented for browser chat UIs; whether it runs unmodified under React Native is
unverified. The `Client` session API is the fallback and is plain HTTP.

---

## 5. Six decisions to take before any code

Each has a recommendation, the reasoning, and what evidence would overturn it. These are the choices
that are expensive to reverse after Phase 3.

### D1 — How money is taken

**Recommendation: no in-app purchase. Membership and merchandise are bought through the existing
WooCommerce checkout, opened in an authorized browser session from the app.**

Why this is allowed, and why it is in fact _required_:

- Apple's guideline **3.1.3(e)**: apps enabling purchase of physical goods or services consumed
  outside the app **must use payment methods other than in-app purchase**. A suit, an alteration and
  a fitting are physical goods and in-person services.
- Google Play's payments policy exempts "purchase or rental of physical goods (such as groceries,
  **clothing**, housewares, electronics)" and physical services, naming gym memberships as an example.
- A Nyoni Circle membership delivers a made-to-measure suit, priority fittings and alterations. It is
  a physical-goods-and-services membership, not digital content.

**The live risk, stated plainly.** Virtual try-on previews are a digital feature consumed inside the
app. If previews were ever sold on their own, Apple's **3.1.1** would require in-app purchase for
them. The design that keeps this clean: previews are **included in membership at every tier**, have a
fair-use allowance, and are **never sold, topped up, or unlocked by a payment inside the app**. Do
not ship a "buy more previews" button on any platform.

**Evidence that would change this:** a written App Review rejection, or current guidelines at
submission time that treat a physical-goods membership as digital content. Check the guidelines again
in the week of submission, and put the reasoning in the App Review notes rather than making the
reviewer guess.

### D2 — How previews are rationed

**Recommendation: a per-tier monthly preview allowance. Keep `convex/model/credits.ts` as the
internal meter; stop showing credits to members.**

The web app still runs the inherited credit meter. Members should see "12 previews left this month",
not a currency. The ledger stays as accounting and as the refund path when a render fails, which it
already handles. This is the change `AGENTS.md` and `PLAN.md` already anticipate, now with a reason
to finish it: a member-facing currency plus an app store is exactly the combination that turns D1
from clear into arguable.

Allowances are a business input, not a technical one. Proposed starting point, to be confirmed by the
house: Client 5 a month, Signature 25, Prestige 60, Circle Elite unlimited within fair use.

### D3 — Where the catalogue comes from

**Recommendation: WooCommerce is the system of record. A scheduled Convex action syncs a projection
into a `products` table. Checkout hands off to the web.**

Browsing must be fast and offline-tolerant, so the app reads Convex, not WordPress. Prices, stock and
variations are authoritative in WooCommerce, so the product screen refreshes the piece it is showing
before it offers a size.

The handoff has a known mechanism and a known catch. The WooCommerce Store API issues a **`Cart-Token`
header** on `/wp-json/wc/store/v1/cart`, which identifies a cart without cookies. The app can build a
cart server-side and then open the web checkout. Loading that token into the web session at checkout
**requires a small snippet on the WordPress side** to accept the token as a query parameter; it is not
built in. Budget that as a WordPress task with a named owner.

**The cheaper alternative, if that snippet is blocked:** open the product permalink with
`?add-to-cart=<id>` and let WooCommerce build the cart in the browser. Fewer moving parts, a worse
handoff for multi-piece looks. Decide once, in Phase 8.

### D4 — Identity

**Recommendation: Clerk with email code, Apple and Google. Keep the existing Clerk instance and its
`convex` JWT template.**

The backend already trusts Clerk, the JWT template already carries `public_metadata` for the admin
role, and the membership status already keys off the account. Nothing about identity needs to change
server-side.

On Apple's **4.8**, the current guideline requires an app that uses third-party or social login to
_also_ offer an equivalent alternative that limits data collection to name and email, lets the user
keep the email private, and does not collect interaction data for advertising without consent. Clerk's
email-code sign-in is a candidate. Do not assume it is accepted; verify against the guideline text at
submission, and implement native Sign in with Apple on iOS anyway because members expect it.

**Account deletion is a Phase 2 deliverable, not a release scramble.** Authenticate the request,
enumerate owned items, avatars, uploads, renders and threads, delete the storage objects, revoke the
session, and keep the records the house must retain. Deleting an app identity does not cancel a
WooCommerce membership; the screen must say so and route to the concierge.

### D5 — What we call things

The concept design says "The Nyoni stylist" for the AI and "Speak to a clothier" for the human. The
brand brief (`docs/01-brand-brief.md`) says the house says "concierge", never "stylist".

**Recommendation: the AI is "the concierge"; the human is "your clothier".** That keeps the brand
brief intact, gives the two channels distinct names, and matches `agent/instructions.md`, which is
already written in the concierge's voice. Update the mockup copy rather than the brand.

### D6 — What the first release is

**Recommendation: a TestFlight and Play internal-testing pilot with real members, not a public
launch.**

The first release has to prove one transaction end to end with a real person: a member previews a
piece, books a fitting, and the showroom sees it. A public listing before that is a store review
risk with nothing to show for it. Go public after the first fitting is booked through the app and the
purchase handoff has taken real money once.

### D7 — Where the code lives

**Recommendation: keep the Next.js app at the repository root; add the Expo app at `mobile/` as a
pnpm workspace package.**

Moving the web app into `apps/web` would break the live Vercel project's root directory and buys
nothing today. The Expo app imports the generated Convex API from the existing `convex/` directory,
which means Metro needs `watchFolders` extended to the repository root. That is a known configuration
and the one piece of setup friction in this layout. Revisit `apps/*` only if a third surface appears.

---

## 6. Navigation and screens

Five tabs, matching the concept design: **Home · Drops · Try-on · Concierge · Wardrobe.** Membership
lives behind the account control in the header, not in the tab bar, because it is visited rarely.

```
(public)
  index                     Front door: the house, what the Circle is, Sign in / Apply
  sign-in                   Email code · Apple · Google
  sign-up                   Same, plus the house's review-and-approval note
(onboarding)                First run only, gated until complete
  photo                     Capture or choose a full-body photo
  preferences               Fit, colours to avoid, home city
  seeding                   The capsule arrives; truthful progress
(app)
  home                      Editorial hero · the annual suit card · a drop · continue where you left off
  drops                     Available now / Coming soon · edits · member-access tiles
  drops/[dropId]            The edit: story, pieces, "try this piece"
  product/[productId]       Photos, price, cloth, sizes, try on, add to bag, ask the concierge
  try-on                    The fitting room: choose a look or a piece, preview, original/preview toggle
  try-on/[renderId]         A finished preview: save, share, shop this piece
  concierge                 Threads list
  concierge/[threadId]      Streaming chat, approvals, proposed looks
  wardrobe                  Owned · Saved looks · Saved to shop
  wardrobe/[itemId]         One piece: photo, attributes, where it came from, use in a look
  wardrobe/add              Camera or library → ingest job → review detected pieces
  looks/new                 Build a look from slots
  looks/[outfitId]          A saved look: pieces, missing pieces, preview it
  circle                    Membership card, tier, benefits, allowance
  circle/suit               The annual suit: status, book the fitting
  circle/appointments       Book and see appointments
  circle/clothier           Contact, with the showrooms and response time
  settings                  Account, notifications, sign out, delete account
```

**Every screen owes four states.** Loading uses a skeleton that matches the final layout, never a bare
spinner. Empty says what to do next with exactly one primary action. Failure says what failed and
offers the retry. Locked says which tier unlocks it and how to ask, never a dead end. The web app's
`EmptyState`, `ErrorAlert` and `JobStepper` are the reference behaviours to port.

**Two screens carry the product.** The **fitting room** must make the previews/fit distinction
unmissable and put "book a fitting" one tap away. The **product screen** must make price, size,
availability and what membership covers understandable without scrolling back up.

---

## 7. The design system on native

The house palette is already verified from the live site and recorded in `docs/01-brand-brief.md` and
`src/app/globals.css`. Port the values, not the CSS.

| Role              | Dark, the default                          | Light              |
| ----------------- | ------------------------------------------ | ------------------ |
| Background        | `#080808` onyx                             | `#F2ECDF` cream    |
| Surface           | `#141414`                                  | `#F7F3EA`          |
| Foreground        | `#F2ECDF`                                  | `#080808`          |
| Primary / brass   | `#CAA663`                                  | `#080808` on cream |
| Muted text        | `#A8A49B`                                  | `#6B665C`          |
| Border            | `#262626`                                  | `#D8D0BE`          |
| Success / warning | reuse the `--success` / `--warning` tokens | same               |

**Type.** Bodoni Moda for display, Manrope for body, IBM Plex Mono for captions and eyebrows. Load
with `expo-font`; do not substitute a system serif and call it Bodoni.

**Dark is the default** and must look deliberate, as it does on the web app. The concept design is a
dark app with cream editorial panels; keep that.

**Rules that are not negotiable on a phone.** A 16px side gutter. Touch targets at least 44pt. Safe
areas respected on every screen including the fitting room's full-bleed image. Dynamic Type honoured
up to the accessibility sizes without clipping. Labels on every control for assistive technology.
Motion under 250ms, and disabled entirely when the system asks for reduced motion.

**Media ratios.** Product and preview images are 4:5 portrait. The capsule photos are 1400px WebP with
transparent-ish studio backgrounds and already sit on a light surface; on the dark theme they need a
cream tile behind them, which is what the concept design does.

Phase 1 produces the written token file and the six component specs before any screen is built:
Button, Tile, PieceCard, SectionHeader, StateBlock (loading/empty/error/locked) and TabBar.

---

## 8. The data model

`convex/schema.ts` is owned by the lead. Everything below is a request with a reason, to be added in
the phase that needs it, not all at once.

### New tables

| Table          | Fields, in outline                                                                                                                                                                     | Added in |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `products`     | `wooId`, `slug`, `name`, `priceUsd`, `images[]`, `categories[]`, `inStock`, `variations[]` (size, stock), `permalink`, `attributes` (the same shape as `items`), `syncedAt`            | Phase 8  |
| `drops`        | `key`, `title`, `subtitle`, `heroImage`, `story`, `productIds[]`, `state` (`available` \| `coming`), `opensAt`, `minTier`, `order`                                                     | Phase 8  |
| `appointments` | `userId`, `showroomId`, `kind` (`fitting` \| `alteration` \| `consultation`), `requestedFor`, `status` (`requested` \| `confirmed` \| `completed` \| `cancelled`), `note`, `staffNote` | Phase 9  |
| `entitlements` | `userId`, `year`, `kind` (`annual_suit`), `status` (`available` \| `booked` \| `in_progress` \| `delivered`), `appointmentId?`, `orderRef?`                                            | Phase 9  |
| `orders`       | `userId`, `wooOrderId`, `status`, `totalUsd`, `lineItems[]`, `placedAt`, `source` (`app_handoff` \| `web`)                                                                             | Phase 8  |
| `devices`      | `userId`, `expoPushToken`, `platform`, `lastSeenAt`                                                                                                                                    | Phase 9  |

### Changes to existing tables

- `items` gains `productId?` so a piece bought from the house links back to its product. The capsule
  already proves the pattern with `collectionKey`; generalise rather than add a second mechanism.
- `outfits` gains nothing. "Shop the missing pieces" is derived: a slot holding an item with a
  `productId` that the member does not own is a missing piece.
- `users.membership` gains nothing. The annual suit lives in `entitlements` so that history survives
  a tier change.

### The rule that does not bend

Ownership is checked on every read of a document by id, every query filters by `userId`, and no
function accepts a `userId` from the client. `convex/lib/auth.ts` already provides `requireUser`,
`requireAdmin` and `assertOwner`. A phone is not a trusted client, and neither is a webview.

---

## 9. Who may do what

| Action                                    | Visitor | Member (Client)       | Member (Signature+)   | Staff              |
| ----------------------------------------- | ------- | --------------------- | --------------------- | ------------------ |
| See the front door and what the Circle is | yes     | yes                   | yes                   | yes                |
| Browse drops                              | no      | yes                   | yes                   | yes                |
| See a drop marked for a higher tier       | no      | locked, with the ask  | yes                   | yes                |
| Wardrobe, looks, previews                 | no      | yes, within allowance | yes, larger allowance | own only           |
| Start a preview                           | no      | yes                   | yes                   | own only           |
| Open checkout                             | no      | yes                   | yes                   | yes                |
| Book a fitting                            | no      | consultation only     | yes, priority         | creates for others |
| Annual suit entitlement                   | no      | none                  | one a year            | reads and advances |
| Set a member's tier                       | no      | no                    | no                    | yes                |

Enforced in Convex, in the function, from the verified identity. A hidden tab is a courtesy, not a
control. The webview that opens checkout carries no Convex credential at all.

---

## 10. The build order

Ten phases. Each is a thin slice that works end to end and can be shown to someone. No phase starts
before the previous one meets its acceptance criteria. Estimates assume one developer and are ranges,
not commitments.

---

### Phase 0 — Decisions and spikes · 3–5 days · `mobile-plan-mvp`

Settle §5. Then spend the rest of the week proving the three things that could invalidate the plan,
each as throwaway code:

1. **Streaming on device.** A bare Expo app opens a session against the live `/eve/v1` agent with a
   Clerk token and renders streamed tokens. Proves `expo/fetch` plus `eve/client`, or tells us to
   write a transport (§4).
2. **Clerk token into Convex.** A signed-in dev build calls `api.users.me` and gets the real record.
   Proves the JWT template, the audience and the token cache work from a phone.
3. **A development build on both platforms.** `eas build --profile development` for iOS and Android,
   installed on a real device.

**Acceptance:** all three spikes run on a physical iPhone and a physical Android device, and the
results are written down. **Stop and re-plan if spike 1 fails**; the concierge is a core tab.

---

### Phase 1 — The shell and the design system · 1 week · `mobile-design-flows`

Workspace at `mobile/`, Metro `watchFolders` reaching the repo root, Expo Router with the five tabs,
the token file from §7, fonts loading, dark and light, and the six base components. Screens are
static with explicit fixtures.

**Acceptance:** the five tabs navigate on both platforms, in both themes, at default and accessibility
text sizes, with safe areas correct. Fixtures are obviously fixtures. Screenshots captured for the
compare loop later.

---

### Phase 2 — Identity and access · 1 week · `mobile-auth-access`

Clerk provider with the secure token cache, email code, Apple and Google, the public front door,
sign-in triggers, session restoration after a cold start, sign-out, expired-session handling, the
preserved destination after sign-in, and account deletion end to end.

**Acceptance:** sign in with each provider independently on a real device. Kill and relaunch: still
signed in. Sign out: protected queries stop returning data. Two different test identities cannot read
each other's records, proved against the backend and not the UI. Deletion removes the records and the
storage objects and revokes the session, and says truthfully what it does not cancel.

---

### Phase 3 — Wardrobe, read-only · 4–6 days · `mobile-build-verify`

The wardrobe grid and the item screen, reading real items from Convex, with the capsule already
seeded for a new account. Image URLs come from Convex storage, never raw storage ids.

**Acceptance:** a brand-new account finishes onboarding and sees the 22 capsule pieces with their
photos. Pull to refresh. Offline shows the last data with an honest banner rather than an empty grid.

---

### Phase 4 — Add a piece · 1 week · `mobile-build-verify`

Camera and library capture with permissions handled, upload through `generateUploadUrl`, the existing
ingest workflow, the job stepper, and the review screen for detected pieces.

**Acceptance:** a photo of real clothing becomes wardrobe items, with progress that matches what the
server is actually doing. A denied camera permission, a cancelled pick, a failed upload and a failed
extraction each produce a clear state and a retry. The allowance is spent and refunded correctly on
failure, verified in the ledger.

---

### Phase 5 — Looks · 4–6 days · `mobile-build-verify`

Build a look from wardrobe pieces against the slot rules in `convex/shared/wardrobe.ts`, including
the suit slot. Save it. See saved looks.

**Acceptance:** an invalid combination is refused with a reason a member understands. A saved look
survives relaunch. Deleting a piece removes it from the looks that used it, which
`removeItemsFromOutfits` already handles.

---

### Phase 6 — The fitting room · 1.5 weeks · `mobile-build-verify`

The member photo (capture, guidance, replace), starting a preview, truthful progress, the finished
preview with an original/preview toggle, save and share. The appearance-not-fit line on the screen,
every time.

**Acceptance:** a real preview completes on a real device from a real photo. A failure refunds the
allowance and says so. A shared link opens the existing public share page. The screen never implies
the garment will fit.

---

### Phase 7 — The concierge · 1 week · `mobile-build-verify`

The streaming chat against the agent, approvals and questions answered inline, proposed looks saved
into the wardrobe, threads persisted.

**Acceptance:** a conversation streams on device, survives backgrounding the app, and resumes after a
dropped connection. An approval prompt blocks the action until answered. The agent only ever names
pieces the wardrobe actually contains.

---

### Phase 8 — Drops and shopping · 2 weeks · `mobile-backend-memberships`

The WooCommerce sync into `products`, the curated `drops`, the drops tab, product detail with sizes
and stock, "try this piece" creating a previewable item from the product photo (the capsule seeder
already proves this), and the checkout handoff decided in D3.

**Acceptance:** the catalogue matches the store for a sampled set of pieces including price, stock and
sizes. A tier-gated drop is genuinely inaccessible to a lower tier, proved against the backend. A
member reaches a real checkout with the right cart. An out-of-stock size cannot be bought. No path in
the app sells a digital feature.

---

### Phase 9 — The Circle · 1.5 weeks · `mobile-backend-memberships`

The membership card, tier and benefits from `convex/shared/membership.ts`, the preview allowance, the
annual suit entitlement with its states, appointment booking against the three showrooms, the clothier
contact with a stated response time, and push notifications.

**Acceptance:** a member books a fitting and staff see it. The entitlement moves from available to
booked and cannot be claimed twice in a year. A lapsed membership shows the right state and the right
ask. A push notification arrives on a real device for a completed preview.

---

### Phase 10 — Release · 1 week · `mobile-build-verify`

EAS production profiles, store listings, screenshots, privacy disclosures, App Review notes that
explain the physical-goods reasoning from D1, TestFlight and Play internal testing with real members.

**Acceptance:** real members install it and complete the core journey. One fitting is booked through
the app. Then, and only then, discuss a public listing.

---

**Total: roughly eleven to thirteen weeks** for one developer to a piloted release, with Phases 8 and
9 carrying the most unknowns because they are genuinely new product rather than a port.

---

## 11. How each phase is proved

Borrowed from `mobile-build-verify`, and non-negotiable:

- **A compile is not a feature.** Type checks and a green build prove nothing about behaviour.
- **An animation is not a database write.** Anything about money, access or persistence is verified
  by reading the backend and by relaunching the app, not by watching the UI.
- **Two identities, always.** Every access check is demonstrated allowed for one account and denied
  for another.
- **Real devices.** A simulator is fine for layout and useless for camera, push, sign-in and payment.
- **Three passes, then stop.** Compare an implemented screen against its reference at most three
  times, fix the highest-impact mismatch each pass, then report what is still different and why.
  Never run a loop until identical; native usability beats pixel imitation.
- **Say what was not tested.** If a device, a provider or a live payment was unavailable, it goes in
  the report as unverified. Never claim a phone test that did not happen.

Repo checks that carry over unchanged: `pnpm typecheck`, `pnpm lint`, `node --test tests/*.test.mjs`,
and `npx tsc --noEmit -p convex/tsconfig.json` for backend changes.

---

## 12. What we measure

Targets are hypotheses until measured. Set the cohort and the window before reading any rate.

| Event                    | Denominator                        | What it tells us                        |
| ------------------------ | ---------------------------------- | --------------------------------------- |
| `onboarding_completed`   | accounts created                   | Whether the front door works            |
| `capsule_seen`           | onboarding completed               | Whether the wardrobe lands              |
| `look_saved`             | members who opened the wardrobe    | Whether styling is understood           |
| `preview_completed`      | members who started one            | Whether the pipeline is reliable enough |
| `preview_to_product_tap` | previews completed                 | Whether previewing drives shopping      |
| `checkout_opened`        | product screens viewed             | Whether the handoff is acceptable       |
| `fitting_booked`         | active members in the window       | The business outcome that matters most  |
| `return_within_14_days`  | members active in the prior window | Whether it is worth keeping             |

`fitting_booked` is the one the house should judge the app by. Everything else is a step toward it.

---

## 13. Risks

| Risk                                                      | Likelihood       | What it costs                           | Cheapest early test                                                 |
| --------------------------------------------------------- | ---------------- | --------------------------------------- | ------------------------------------------------------------------- |
| `eve/client` cannot stream under React Native             | medium           | The concierge tab, a week               | Phase 0 spike 1                                                     |
| App Review treats previews as digital content             | low, high impact | The billing model, a resubmission cycle | Review notes drafted in Phase 0, guidelines re-read at submission   |
| WooCommerce cart handoff needs WordPress work nobody owns | medium           | Phase 8 slips                           | Name the WordPress owner in Phase 0; fall back to `?add-to-cart=`   |
| 775 products with variations sync badly, sizes wrong      | medium           | Members cannot buy the right size       | Sample 20 products against the live store in Phase 8                |
| Preview cost per member exceeds the membership margin     | medium           | The allowance model                     | Cost per render is already measurable today; model it in Phase 0    |
| Clerk native auth credential setup stalls                 | medium           | Phase 2 slips                           | Phase 0 spike 3 includes one native provider                        |
| Photo quality makes previews look poor                    | high             | The core promise                        | Onboarding guidance and a reshoot path; measure `preview_completed` |
| The phone becomes a second source of truth                | low, high impact | Correctness everywhere                  | No business logic in the app; Convex functions only                 |

---

## 14. Not in the first release

Deliberately excluded, with the reason:

- **A social feed, following, or member-to-member anything.** Not the product.
- **In-app checkout with a card form.** D1 forbids what it would gain, and PCI scope is not worth it.
- **Measurements capture on the phone.** Measurements belong to the clothier; a self-measured chest is
  worse than no chest. The app books the fitting instead.
- **Offline previews.** The pipeline is server-side by nature.
- **An Android tablet or iPad layout.** Phone first; add when someone asks.
- **Replacing the staff console.** Staff keep the web app.
- **Killing the web app.** It hosts the agent and the share pages.

---

## 15. Appendix

### Repository layout after Phase 1

```
NyoniMembers/
  convex/            unchanged, shared by both clients
  agent/             unchanged, hosted by the Next.js deployment
  src/               the Next.js app: agent host, staff console, share pages
  mobile/            the Expo app
    app/             Expo Router routes, mirroring §6
    components/      the design system from §7
    lib/             convex client, clerk, theme, format
    assets/          fonts, icons, splash
  docs/              this plan and the ones it builds on
  .claude/skills/    the five skills that run the phases
```

### The commands that will matter

```bash
pnpm --filter mobile expo start --dev-client   # run against a development build
eas build --profile development --platform all # the build you install once
eas build --profile production --platform all  # the build you submit
pnpm typecheck                                  # web + convex + agent, unchanged
```

### What to read before touching each area

- Product voice and the copy deck: `docs/01-brand-brief.md`
- Why memberships work this way: `docs/02-luxury-membership-research.md`
- The original web plan, still the contract for the backend: `PLAN.md`, `docs/03-nyoni-members-app-plan.md`
- What is deployed and configured today: `docs/04-launch-checklist.md`, `README.md`
- Repo conventions that still apply to Convex and the agent: `AGENTS.md`

### Sources verified on 21 September 2026

- Expo SDK 57 stable, SDK 58 beta: [expo.dev/changelog](https://expo.dev/changelog)
- `expo/fetch` streaming: [docs.expo.dev/versions/latest/sdk/expo](https://docs.expo.dev/versions/latest/sdk/expo/)
- Clerk Expo quickstart, token cache, development-build requirements: [clerk.com/docs](https://clerk.com/docs/expo/getting-started/quickstart)
- Convex React Native client: [docs.convex.dev/quickstart/react-native](https://docs.convex.dev/quickstart/react-native)
- App Store Review Guidelines 3.1.1, 3.1.3(e), 4.8: [developer.apple.com/app-store/review/guidelines](https://developer.apple.com/app-store/review/guidelines/)
- Google Play payments policy exemptions: [support.google.com](https://support.google.com/googleplay/android-developer/answer/9858738)
- WooCommerce Store API cart tokens: [developer.woocommerce.com](https://developer.woocommerce.com/docs/apis/store-api/cart-tokens/)
