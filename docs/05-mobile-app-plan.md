# Nyoni Circle — the mobile app plan

The master plan for **Nyoni Circle**, a new Expo app for iOS and Android. It is the house's private
members app: shop the drops, preview a piece on your own photo, take styling advice, keep a wardrobe,
save looks, manage your membership, and reach a clothier. Members check out through WooCommerce.

**This is a new product, not a port of the web app.** New Expo app, new Convex backend, a schema
designed around this journey rather than inherited from the Fitcheck wardrobe app it grew out of. One
thing carries over, and only because re-deriving it would be waste: the tuned AI image pipeline and
the concierge agent (§2).

**Status: proposed, 21 September 2026.** Nothing here is built. The existing web app stays live and
unchanged while this is built. Facts verified against a named source on 21 September 2026 are dated;
choices still open are in §5 with a recommendation and the evidence that would settle them.

### The three decisions already taken

| Decision                                      | Choice                                                                                    |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| How much of the existing system comes with it | A fresh app and a fresh backend. Only the AI pipeline and the concierge agent carry over. |
| Where the code lives                          | A new `circle/` folder in this repository, as its own workspace package.                  |
| What the first release contains               | The full journey. Everything in the concept design ships at once.                         |

**One concern, recorded once and then set aside.** Shipping the whole journey before any member sees
it means roughly four months without feedback, and a larger surface on the first App Review. The plan
mitigates this without changing the decision: every milestone in §10 produces an installable build,
so the house can hold the app in its hands throughout, and the release is still a single public one.

---

## 0. How to read this

| Section                | Answers                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| §1 The product         | What Nyoni Circle is, who it is for, and the journey it serves   |
| §2 New vs carried over | What gets written fresh, and the one thing that does not         |
| §3 Architecture        | How the phone, Convex, WooCommerce and the agent fit together    |
| §4 Stack               | Exact packages, verified versions, what to re-check              |
| §5 Decisions           | Seven choices, with recommendations and the evidence behind them |
| §6 Data model          | The new schema, designed from this product                       |
| §7 Screens             | Navigation map, every screen, every state                        |
| §8 Design              | The house design system in React Native                          |
| §9 Access              | Who may do what, and where it is enforced                        |
| §10 Milestones         | Eleven milestones to one release, each installable               |
| §11 Verification       | What "done" means and the evidence that proves it                |
| §12 Measurement        | What to count, and against what                                  |
| §13 Risks              | What could sink a milestone, and the cheap early test            |
| §14 Not in v1          | What is deliberately left out                                    |
| §15 Appendix           | Layout, commands, and what to read first                         |

The concept design is at `docs/assets/mobile-concept.webp`: six screens, a reference for tone and
layout only. It is not a source of measurements or final copy.

### The skills that run this plan

Installed at `.claude/skills/`. Each milestone in §10 names the one that runs it.

| Skill                        | Runs                                                          |
| ---------------------------- | ------------------------------------------------------------- |
| `mobile-plan-mvp`            | This document and any re-scoping of it                        |
| `mobile-design-flows`        | M1 design system, screen specs, visual references             |
| `mobile-auth-access`         | M2 identity, sessions, roles, account deletion                |
| `mobile-backend-memberships` | M3–M4 and M9: catalogue, orders, entitlements, purchase state |
| `mobile-build-verify`        | Every feature milestone: build one slice, prove it, move on   |

They carry a worked fitness-marketplace example from the tutorial they were adapted from. That
example is not this product. Where it conflicts with this plan, this plan wins.

---

## 1. The product

**Nyoni Circle brings Nyoni Couture's shopping, styling and personal service into one place, for
members only.**

A member can:

- Shop exclusive drops and get early access to selected collections.
- Virtually try on pieces using their own photo before buying.
- Get styling advice for weddings, business, travel and everyday occasions.
- Build a wardrobe that mixes what they already own with what they buy from the house.
- Save complete looks and shop the pieces they are missing.
- See their membership benefits, including the annual suit entitlement and priority fittings.
- Reach a human clothier for appointments, alterations and personal assistance.

**The journey every milestone serves:**

> discover a piece → style it → preview it on yourself → purchase or book a fitting → save it to your wardrobe

**The purpose:** help members dress with confidence, make better purchase decisions, and get more from
their relationship with the house.

**The promise we never overstate.** A virtual try-on previews _appearance_. A clothier confirms _fit_.
Every preview surface says so in the interface, not only in a policy page. That is an honesty
requirement, and it is also why the app drives toward a fitting rather than away from one.

**Who it is for.** Members and prospective members of The Nyoni Circle: men who buy made-to-measure,
in or near Charlotte, Atlanta and Houston, plus remote members who travel in for fittings. Tiers and
prices are set by the house: Client at no fee, Signature at US$549 a year, Prestige at US$749, Circle
Elite at US$949 by invitation.

**What it is not.** Not a public storefront, not a social network, not a replacement for
nyonicouture.com. It is the members' door.

---

## 2. What is new, and the one thing that carries over

### Written from scratch

Everything the member touches, and everything under it:

- **The Expo app.** Every screen, every component, every navigation decision. Designed for a phone,
  not adapted from a sidebar layout.
- **The Convex backend.** A new deployment with the schema in §6. No `planCredits`, no `packCredits`,
  no `creditLedger`, no Clerk billing reconciliation, no `free`/`pro`/`plus`. Those were Fitcheck's
  answers to Fitcheck's business, and carrying them into a membership house that sells suits is how
  a rebuild quietly becomes a port.
- **Commerce.** Catalogue, drops, product detail, sizes, the bag, checkout and orders. None of this
  exists today in any form.
- **Service.** Appointments, the annual suit entitlement, the clothier channel.
- **Native capability.** Camera capture, permissions, push notifications, secure token storage.

### Carried over, deliberately

Roughly 800 lines of prompt engineering and model integration, because it is tuned, it works, and
re-deriving it means repeating weeks of image-model trial and error for an identical result.

| What                             | Where it is now                                    | Why it carries                                                                                                                                                                                                                           |
| -------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The try-on prompt                | `convex/ai/prompts.ts` → `renderPrompt()`          | Suit-aware layering, identity preservation, the full-body reconstruction rules that stop gpt-image-2 producing an enlarged head from a headshot, fit and drape language. Takes plain inputs, so it is already independent of the schema. |
| Detection and extraction prompts | same file                                          | `detectionInstructions()` and `extractionPrompt()`: what counts as one garment, the matched-suit rule, flat-lay extraction with a transparent background.                                                                                |
| Model integration                | `convex/ai/openai.ts`                              | The gpt-image-2 edit call shapes, the transparency workaround, embeddings, and the hard-won constraint that **gpt-image-2 rejects `input_fidelity`**.                                                                                    |
| Utilities                        | `convex/ai/colours.ts`, `convex/ai/image_input.ts` | Colour naming and image input normalisation.                                                                                                                                                                                             |
| The concierge                    | `agent/instructions.md`, `agent/tools/*`           | The persona, the voice, and the tool surface. The Convex calls inside each tool are rewritten against the new schema; the definitions and instructions stay.                                                                             |

**What "carries over" honestly means.** The prompts and the model calls move across almost unchanged.
The plumbing around them, which reads and writes the old tables, is rewritten. Expect to keep the
files' reasoning and rewrite their data access. That is a two-day job per pipeline, not a two-week
one, and it is the difference between a fresh build and a wasteful one.

**What does not carry over from the agent:** `get_weather`, the sandbox tools (`bash`, `read_file`,
`write_file`), and the credit-quoting tools. A concierge that can run shell commands is a liability,
not a feature.

---

## 3. The architecture

```
                    ┌──────────────────────────────┐
                    │   Nyoni Circle (Expo)        │
                    │   iOS · Android              │
                    └───┬──────────┬───────────┬───┘
                        │          │           │
    Clerk session JWT   │          │           │  in-app browser,
    (audience: convex)  │          │           │  no app credential
                        ▼          │           ▼
         ┌─────────────────────┐   │   ┌────────────────────────┐
         │  Convex "circle"    │   │   │  WooCommerce order-pay │
         │  new deployment     │   │   │   nyonicouture.com     │
         │  data · storage     │   │   └───────────┬────────────┘
         │  jobs · AI actions  │   │               │
         └──┬───────────┬──────┘   │               │ signed webhook
            │           │          │               │ + scheduled reconcile
            │           │ REST v3  │               │
            │           └──────────┼───────────────┘
            │                      │
            ▼                      ▼
   ┌────────────────┐   ┌──────────────────────┐
   │ OpenAI via the │   │  concierge agent     │
   │  AI Gateway    │   │  /eve/v1 on Vercel   │
   └────────────────┘   └──────────────────────┘
```

**Five things that diagram commits to.**

1. **A new Convex deployment.** The live web app keeps its own backend and keeps working. No
   migration, no shared schema, no risk of breaking a running system to reshape it. When Circle
   ships, the web app either retires or is repointed; that is a decision for then, not now.

2. **The phone talks to Convex directly.** Same authenticated function calls, no REST layer in
   between, and the realtime queries that make job progress truthful work the same on a device.

3. **WooCommerce takes the money, and the order is created before the member pays.** Convex creates
   the order server-side through the REST API with the member's id stamped on it, then the app opens
   the returned pay URL. Attribution is guaranteed before a card is touched (§5 D3).

4. **The agent stays where it is.** It already runs at `/eve/v1` on the existing Vercel deployment.
   The phone opens a session against it over HTTPS with a Clerk token. The web deployment keeps three
   jobs: agent host, staff console and public share pages.

5. **The phone holds no privileged key.** Clerk gives it a session token; Convex derives the member
   from it. The WooCommerce consumer secret, the webhook secret, the Clerk secret and the AI key all
   stay server-side. The checkout browser carries no app credential at all.

---

## 4. The stack

Verified against official sources on 21 September 2026. **Re-verify before M0 begins.**

| Layer            | Choice                                                                              | Version seen 21 Sep 2026                                                | Source                                                                   |
| ---------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| App runtime      | Expo SDK                                                                            | 57 stable (57.0.24); SDK 58 in beta since 15 Sep with React Native 0.88 | [expo.dev/changelog](https://expo.dev/changelog)                         |
| React Native     | via Expo 57                                                                         | 0.86                                                                    | [expo.dev/changelog](https://expo.dev/changelog)                         |
| Navigation       | Expo Router                                                                         | ships with the SDK                                                      | [docs.expo.dev](https://docs.expo.dev/)                                  |
| Identity         | `@clerk/expo` with `tokenCache` from `@clerk/expo/token-cache`, `expo-secure-store` | current                                                                 | [clerk.com/docs](https://clerk.com/docs/expo/getting-started/quickstart) |
| Backend client   | `convex` → `ConvexReactClient` + `ConvexProvider`                                   | same library as web                                                     | [docs.convex.dev](https://docs.convex.dev/quickstart/react-native)       |
| Streaming HTTP   | `expo/fetch`, WinterCG fetch with real `ReadableStream`                             | SDK 57                                                                  | [docs.expo.dev](https://docs.expo.dev/versions/latest/sdk/expo/)         |
| Agent client     | `eve` 0.56 `Client` from `eve/client`                                               | installed                                                               | `node_modules/eve/docs/guides/client/overview.mdx`                       |
| Checkout browser | `expo-web-browser`                                                                  | ships with the SDK                                                      | [docs.expo.dev](https://docs.expo.dev/)                                  |
| Builds           | EAS Build and EAS Submit, development build required                                | current                                                                 | [docs.expo.dev](https://docs.expo.dev/)                                  |

**Pin SDK 57.** SDK 58 is beta on a release-candidate React Native. Starting a new product on that
buys nothing and costs a week the first time a native module lags.

**A development build is required, not Expo Go.** Clerk's native auth components cannot run in Expo
Go. Native Apple and Google sign-in need credential setup, environment variables and an iOS URL
scheme. Budget `eas build --profile development` from day one.

**Two facts that shape M0.** React Native's default `fetch` cannot stream a response body, and the
concierge is a streaming NDJSON chat. `expo/fetch` solves that, but `eve` 0.56's `ClientOptions`
exposes only `host`, `auth`, `headers` and `redirect`, with **no fetch injection point**, so the app
must either install `expo/fetch` globally or write a thin transport against the documented session
protocol. Separately, `useEveAgent` from `eve/react` is documented for browser chat UIs and is
unverified under React Native; the `Client` session API is the fallback and is plain HTTP.

---

## 5. Seven decisions

### D1 — How money is taken

**No in-app purchase. Members check out through WooCommerce, opened in an in-app browser.**

This is not merely permitted. For the physical side it is required. Apple's guideline **3.1.3(e)**:

> If your app enables people to purchase physical goods or services that will be consumed outside of
> the app, you must use purchase methods other than in-app purchase to collect those payments, such
> as Apple Pay or traditional credit card entry.

A suit, an alteration and a fitting are physical goods and in-person services. Selling them through
in-app purchase would itself be a violation. Google Play's payments policy matches, exempting
"purchase or rental of physical goods (such as groceries, **clothing**, housewares, electronics)".

**Linking out is explicitly allowed for a US app.** Apple's 3.1.3 preamble normally bars apps from
steering members to another payment method, then carves out an exception: "except for apps on the
United States storefront". Guideline 3.1.1(a) repeats it, stating the external-link entitlements "are
not required for developers to include buttons, external links, or other calls to action in their
United States storefront apps". Nyoni is a US house with US showrooms. **If the app is later
published to non-US storefronts, that restriction applies there** and the buy button needs
region-aware handling. Note that in scope.

**The live risk is the try-on, not the suit.** Guideline **3.1.1** requires in-app purchase "if you
want to unlock features or functionality within your app". A preview is functionality inside the app.
A reviewer could read a website-bought membership as unlocking it. Three design rules keep that
defensible, and they are requirements, not preferences:

1. **Every signed-in member gets previews, including the free Client tier.** Paying never unlocks the
   feature; it only raises the fair-use allowance.
2. **Nothing digital is ever sold in the app.** No preview packs, no top-ups, no unlock button, on
   any platform.
3. **The membership is described as what it is:** a made-to-measure suit each year, priority
   fittings, complimentary alterations. Physical goods and in-person services.

Do not lean on guideline 3.1.3(b) on multiplatform services. It ends with the condition that the
items must "also be available as in-app purchases within the app", which works against us. The
argument rests on 3.1.3(e).

**Before submission:** put this reasoning in the App Review notes so the reviewer is not guessing,
re-read the guidelines that week, and consider a pre-submission question through App Store Connect if
the house wants certainty rather than a well-reasoned position. This is store policy, not law, and
the developer agreement is worth showing to counsel.

### D2 — How previews are rationed

**A monthly preview allowance per tier, counted in a simple per-period counter. No credits, no
ledger, no currency shown to a member.**

A member sees "12 previews left this month". The Fitcheck credit ledger does not come across; its
double-entry accounting existed to support purchasable credit packs, which D1 forbids. A failed
render refunds the count.

Allowances are a house decision. Starting point to confirm: Client 5 a month, Signature 25, Prestige
60, Circle Elite unlimited within fair use. Whatever the numbers, every tier including Client must
have a working allowance above zero, per D1.

### D3 — How checkout and purchase tracking work

**Convex creates the WooCommerce order first, then the app opens the pay URL.**

`POST /wp-json/wc/v3/orders` accepts `customer_id`, `line_items` and `meta_data`, so the member's id
is stamped on the order at creation. The response carries a `payment_url` of the form
`https://nyonicouture.com/checkout/order-pay/{id}/?key=wc_order_…`, and that is what
`expo-web-browser` opens. The order exists in both systems, already linked to a member, before a card
is entered. **No custom WordPress code is required**, which is why this replaces the cart-token
handoff considered earlier.

**Tracking is then a solved problem, with three caveats.**

- **Webhooks are the fast path, not the ledger.** WooCommerce fires `order.created` and
  `order.updated` and signs each delivery with an HMAC-SHA256 in the `X-WC-Webhook-Signature` header,
  computed over the raw body. But delivery runs on WordPress cron so it lags, there is no duplicate
  prevention, and **WooCommerce disables a webhook after five consecutive failures, silently**.
- **Reconcile on a schedule.** A Convex cron reads orders modified since the last successful sweep
  and corrects anything the webhook missed. This is what makes the numbers right rather than roughly
  right.
- **The backend has no webhook door yet.** `convex/http.ts` in the current repo registers no routes
  at all. The signed endpoint is real work in M4, not configuration.

**The API key requirement goes up.** The launch checklist assumes a read-only WooCommerce key.
Creating orders needs read and write. That is a permission decision for whoever administers the store,
and it needs an owner named in M0.

**One honest gap.** A member who buys on nyonicouture.com in an ordinary browser produces an order
with no member id. Match on billing email after the fact; it usually works and sometimes will not.

### D4 — Identity

**Clerk, with email code, Apple and Google. A new Clerk instance is not needed; the existing one can
serve both apps.**

Apple's **4.8** requires an app using third-party or social login to also offer an equivalent
alternative that limits data collection to name and email, lets the member keep the email private,
and does not collect interaction data for advertising without consent. Clerk's email-code sign-in is
a candidate; verify it against the guideline text at submission rather than assuming, and implement
native Sign in with Apple on iOS regardless because members expect it.

**Account deletion is an M2 deliverable, not a release scramble.** Authenticate the request, enumerate
owned pieces, photos, previews, looks and conversations, delete the storage objects, revoke the
session, retain what the house must retain. Deleting an app identity does not cancel a WooCommerce
membership; say so on the screen and route to the concierge.

### D5 — What we call things

The concept design says "The Nyoni stylist" for the AI and "Speak to a clothier" for the human. The
brand brief says the house says "concierge", never "stylist".

**The AI is "the concierge". The human is "your clothier".** That keeps the brand brief intact, gives
the two channels distinct names, and matches `agent/instructions.md`, already written in the
concierge's voice. Update the mockup copy, not the brand.

### D6 — What the first release is

**The full journey, in one public release, per the decision recorded at the top.**

Every milestone still produces an installable build so the house sees progress on a real phone. The
public listing waits until all of §7 works. Before it goes public, run a short closed test with real
members through TestFlight and Play internal testing; that is a test cycle, not a separate release.

### D7 — Where the code lives

**A new `circle/` folder in this repository, as its own pnpm workspace package, containing both the
Expo app and its Convex backend.**

```
circle/
  app/         Expo Router routes
  components/  the design system
  convex/      the new backend and schema
  lib/         clerk, convex client, theme, format, woo
```

The existing Next.js app stays at the repository root and keeps its own `convex/`. Two Convex
deployments, two schemas, no interference. The Expo app runs `npx convex dev` from `circle/`.

---

## 6. The data model

Designed from this product. Names are new because the concepts are new: a member is not a "user with
a plan", a piece is not an "item with credits spent on it".

### Member and identity

| Table       | Fields in outline                                                                                                                                                                                          | Indexes                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `members`   | `clerkId`, `email`, `name`, `imageUrl`, `role`, `phone?`, `homeShowroomId?`, `prefs {fit, avoidColours[], homeCity?, sizes?}`, `membership {tier, status, since?, renewsAt?}`, `onboardedAt?`, `createdAt` | `by_clerkId`, `by_email` |
| `photos`    | `memberId`, `storageId`, `kind` (`portrait` \| `reference`), `isPrimary`, `width`, `height`, `createdAt`                                                                                                   | `by_member`              |
| `devices`   | `memberId`, `expoPushToken`, `platform`, `lastSeenAt`                                                                                                                                                      | `by_member`, `by_token`  |
| `allowance` | `memberId`, `periodKey` (`YYYY-MM`), `previewsUsed`, `updatedAt`                                                                                                                                           | `by_member_period`       |

### Commerce

| Table      | Fields in outline                                                                                                                                                                                                                                                 | Indexes                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `products` | `wooId`, `slug`, `name`, `priceUsd`, `salePriceUsd?`, `permalink`, `images[]`, `category`, `subcategory`, `attributes` (the styling attributes the concierge and the try-on prompt read), `inStock`, `variations[{wooId, size, inStock}]`, `minTier?`, `syncedAt` | `by_wooId`, `by_slug`, `by_category`, search on name and description |
| `drops`    | `key`, `title`, `subtitle`, `story`, `heroStorageId`, `state` (`available` \| `coming`), `opensAt?`, `minTier`, `productIds[]`, `order`                                                                                                                           | `by_state_order`                                                     |
| `bags`     | `memberId`, `lines[{productId, variationId, size, qty}]`, `updatedAt`                                                                                                                                                                                             | `by_member`                                                          |
| `orders`   | `memberId`, `wooOrderId`, `wooOrderKey`, `status`, `totalUsd`, `lines[]`, `paymentUrl`, `placedAt`, `paidAt?`, `source` (`app` \| `web`)                                                                                                                          | `by_member`, `by_wooOrderId`                                         |

### Wardrobe and styling

| Table             | Fields in outline                                                                                                                                                                                                                                     | Indexes                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `pieces`          | `memberId`, `source` (`owned` \| `purchased` \| `house`), `productId?`, `storageId`, `size?`, `attributes {name, category, subcategory, colours, pattern, material, season, formality, fit, brand, description}`, `status`, `searchText`, `createdAt` | `by_member_category`, `by_member_product`, search on `searchText` |
| `pieceEmbeddings` | `pieceId`, `memberId`, `embedding`                                                                                                                                                                                                                    | vector index                                                      |
| `looks`           | `memberId`, `title`, `occasion?`, `slots {outerwear?, top?, suit?, bottom?, shoes?, accessories[]}`, `source` (`member` \| `concierge`), `createdAt`                                                                                                  | `by_member`                                                       |
| `previews`        | `memberId`, `photoId`, `lookId?`, `productId?`, `storageId?`, `status`, `jobId?`, `shareToken?`, `createdAt`                                                                                                                                          | `by_member`, `by_look`, `by_shareToken`                           |

### Service

| Table           | Fields in outline                                                                                                                                 | Indexes                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `appointments`  | `memberId`, `showroomId`, `kind` (`fitting` \| `alteration` \| `consultation`), `requestedFor`, `status`, `note?`, `staffNote?`, `entitlementId?` | `by_member`, `by_showroom_status` |
| `entitlements`  | `memberId`, `year`, `kind` (`annual_suit`), `status` (`available` \| `booked` \| `in_progress` \| `delivered`), `appointmentId?`, `orderRef?`     | `by_member_year`                  |
| `conversations` | `memberId`, `title`, `sessionId`, `lastMessageAt`                                                                                                 | `by_member`                       |
| `jobs`          | `memberId`, `kind` (`ingest` \| `preview` \| `sync`), `status`, `steps[]`, `result?`, `error?`                                                    | `by_member_status`                |

### Constants that come across as values, not code

Tiers, prices, benefits, cloth grades, showrooms, concierge contacts, garment categories and outfit
slots are already correct in `convex/shared/membership.ts`, `convex/shared/house.ts` and
`convex/shared/wardrobe.ts`. Copy the values into `circle/convex/shared/`. Do not import across the
two backends; a shared import across deployments is a coupling that will hurt later.

### The rule that does not bend

Every query filters by `memberId` derived from the verified Clerk identity. No function accepts a
member id from the client. Ownership is checked before any read of a document by id. A phone is not a
trusted client, and neither is a webview.

---

## 7. Navigation and screens

Five tabs, matching the concept design: **Home · Drops · Try-on · Concierge · Wardrobe.** The Circle
sits behind the account control in the header, because it is visited rarely and deserves room.

```
(public)
  index                    The house, what the Circle is, Sign in / Apply
  sign-in                  Email code · Apple · Google
  sign-up                  Same, with the review-and-approval note
(onboarding)               First run only
  photo                    Capture or choose a full-body photo, with guidance
  preferences              Fit, colours to avoid, home city, sizes
  ready                    What the app does, and the appearance-not-fit promise
(app)
  home                     Editorial hero · the annual suit card · the current drop · continue
  drops                    Available now / Coming soon · edits · member-access tiles
  drops/[dropId]           The edit: story, pieces, try this piece
  product/[productId]      Photos, price, cloth, sizes, try on, add to bag, ask the concierge
  bag                      Lines, sizes, totals, checkout
  orders                   Past orders and their status
  try-on                   The fitting room: pick a look or a piece, preview, original/preview toggle
  try-on/[previewId]       A finished preview: save, share, shop this piece, book a fitting
  concierge                Conversations
  concierge/[id]           Streaming chat, approvals, proposed looks
  wardrobe                 Owned · Saved looks · Saved to shop
  wardrobe/[pieceId]       One piece: photo, attributes, where it came from, use in a look
  wardrobe/add             Camera or library → ingest job → review detected pieces
  looks/new                Build a look from slots
  looks/[lookId]           A saved look: pieces, missing pieces, preview it
  circle                   Membership card, tier, benefits, allowance
  circle/suit              The annual suit: status, book the fitting
  circle/appointments      Book and see appointments
  circle/clothier          Contact, showrooms, response time
  settings                 Account, notifications, sign out, delete account
```

**Every screen owes four states.** Loading uses a skeleton matching the final layout, never a bare
spinner. Empty says what to do next with exactly one primary action. Failure says what failed and
offers the retry. Locked says which tier unlocks it and how to ask, never a dead end.

**Three screens carry the product.** The **fitting room** must make the appearance-versus-fit
distinction unmissable and keep "book a fitting" one tap away. The **product screen** must make price,
size, availability and what membership covers understandable without scrolling back. The **bag** must
never surprise anyone about what happens when they tap checkout, because what happens is a browser.

---

## 8. The design system on native

The house palette is verified from the live site and recorded in `docs/01-brand-brief.md`. Port the
values, not the CSS.

| Role           | Dark, the default | Light              |
| -------------- | ----------------- | ------------------ |
| Background     | `#080808` onyx    | `#F2ECDF` cream    |
| Surface        | `#141414`         | `#F7F3EA`          |
| Foreground     | `#F2ECDF`         | `#080808`          |
| Primary, brass | `#CAA663`         | `#080808` on cream |
| Muted text     | `#A8A49B`         | `#6B665C`          |
| Border         | `#262626`         | `#D8D0BE`          |

**Type.** Bodoni Moda for display, Manrope for body, IBM Plex Mono for captions and eyebrows. Load
with `expo-font`. Do not substitute a system serif and call it Bodoni.

**Dark is the default**, as on the web app. The concept design is a dark app with cream editorial
panels; keep that.

**Not negotiable on a phone.** A 16px side gutter. Touch targets at least 44pt. Safe areas respected
everywhere, including the full-bleed fitting room. Dynamic Type honoured into the accessibility sizes
without clipping. Labels on every control for assistive technology. Motion under 250ms and disabled
when the system asks for reduced motion.

**Media.** Product and preview images are 4:5 portrait. Product photography sits on a light studio
background, so on the dark theme it needs a cream tile behind it, exactly as the concept design does.

M1 produces the written token file and eight component specs before any screen is built: Button,
Tile, PieceCard, ProductCard, SectionHeader, StateBlock, PriceRow and TabBar.

---

## 9. Who may do what

| Action                        | Visitor | Client                | Signature+            | Staff              |
| ----------------------------- | ------- | --------------------- | --------------------- | ------------------ |
| See the front door            | yes     | yes                   | yes                   | yes                |
| Browse drops                  | no      | yes                   | yes                   | yes                |
| A drop gated to a higher tier | no      | locked, with the ask  | yes                   | yes                |
| Wardrobe, looks, previews     | no      | yes, within allowance | yes, larger allowance | own only           |
| Add to bag, checkout          | no      | yes                   | yes                   | yes                |
| Book a fitting                | no      | consultation only     | yes, priority         | creates for others |
| Annual suit entitlement       | no      | none                  | one a year            | reads and advances |
| Set a member's tier           | no      | no                    | no                    | yes                |

Enforced in Convex, inside the function, from the verified identity. A hidden tab is a courtesy, not
a control.

---

## 10. The milestones

Eleven milestones to one public release. Each ends with an installable build and a demonstrable
outcome. No milestone starts before the previous one meets its acceptance criteria. Estimates assume
one developer and are ranges, not commitments.

### M0 — Decisions and spikes · 1 week · `mobile-plan-mvp`

Settle §5, name an owner for the WooCommerce read-write key, then prove the three things that could
invalidate the plan, each as throwaway code:

1. **Streaming on device.** A bare Expo app opens a session against the live `/eve/v1` agent with a
   Clerk token and renders streamed tokens. Proves `expo/fetch` with `eve/client`, or tells us to
   write a transport.
2. **Clerk into Convex.** A signed-in development build calls a function on the new deployment and
   gets a real record back.
3. **Order-first checkout.** A script creates a WooCommerce order through the REST API with member
   metadata and opens the returned `payment_url` on a device. Proves D3 before anything depends on it.

**Acceptance:** all three run on a physical iPhone and a physical Android device, written up. **Stop
and re-plan if spike 1 or 3 fails.**

### M1 — Backend skeleton, design system, shell · 1.5 weeks · `mobile-design-flows`

The `circle/` workspace, a new Convex deployment with the §6 schema, Metro configured, Expo Router
with five tabs, the token file, fonts, dark and light, and the eight base components. Screens are
static with explicit fixtures.

**Acceptance:** five tabs navigate on both platforms, in both themes, at default and accessibility
text sizes, safe areas correct. Fixtures are obviously fixtures. Reference screenshots captured.

### M2 — Identity and onboarding · 1 week · `mobile-auth-access`

Clerk with secure token cache, email code, Apple and Google, the public front door, sign-in triggers,
session restoration after a cold start, sign-out, expired sessions, the preserved destination, the
onboarding flow, and account deletion end to end.

**Acceptance:** each provider verified independently on a real device. Kill and relaunch: still signed
in. Two test identities cannot read each other's records, proved against the backend rather than the
UI. Deletion removes records and storage objects, revokes the session, and says truthfully what it
does not cancel.

### M3 — Catalogue and drops · 1.5 weeks · `mobile-backend-memberships`

The scheduled WooCommerce sync into `products`, the curated `drops`, the drops tab and the drop
screen.

**Acceptance:** a sampled set of 20 products matches the live store on price, stock and sizes. A
tier-gated drop is genuinely inaccessible to a lower tier, proved against the backend. The sync is
safe to re-run and a deleted product disappears.

### M4 — Product, bag, checkout, orders · 2 weeks · `mobile-backend-memberships`

Product detail with sizes and live stock, the bag, order creation through the REST API, the pay URL
in an in-app browser, the signed webhook endpoint, the reconciliation cron, and the orders screen.

**Acceptance:** a real order is placed end to end with real money, appears in WooCommerce with the
member id on it, and appears in the app with the right status. A webhook with a bad signature is
rejected. A duplicate webhook changes nothing. Killing the app mid-checkout still produces a correct
order once reconciliation runs. An out-of-stock size cannot be bought.

### M5 — Wardrobe and capture · 2 weeks · `mobile-build-verify`

The wardrobe, the piece screen, camera and library capture with permissions, upload, the rebuilt
ingest pipeline using the carried-over detection and extraction prompts, and the job stepper.

**Acceptance:** a photo of real clothing becomes pieces, with progress that matches what the server is
doing. Denied permission, cancelled pick, failed upload and failed extraction each produce a clear
state and a retry. A purchased product becomes a piece automatically when its order is paid.

### M6 — Looks · 1 week · `mobile-build-verify`

Build a look from pieces against the slot rules including the suit slot, save it, browse saved looks,
and see which pieces in a look are for sale rather than owned.

**Acceptance:** an invalid combination is refused with a reason a member understands. A saved look
survives relaunch. Deleting a piece removes it from the looks that used it. "Shop the missing pieces"
lands on the right products.

### M7 — The fitting room · 2 weeks · `mobile-build-verify`

The member photo, starting a preview from a look or a single product, truthful progress, the finished
preview with an original/preview toggle, save, share, and the allowance from D2.

**Acceptance:** a real preview completes on a real device from a real photo, using the carried-over
render prompt. A failure returns the allowance and says so. The allowance blocks a member who has
spent it, with an honest message and no way to buy more. The screen never implies the garment will
fit.

### M8 — The concierge · 1.5 weeks · `mobile-build-verify`

The streaming chat, approvals and questions answered inline, proposed looks saved to the wardrobe,
conversations persisted, and the agent's tools rewritten against the new schema.

**Acceptance:** a conversation streams on device, survives backgrounding, and resumes after a dropped
connection. An approval prompt blocks the action until answered. The concierge only ever names pieces
and products that exist.

### M9 — The Circle · 2 weeks · `mobile-backend-memberships`

The membership card, tier and benefits, the allowance display, the annual suit entitlement with its
states, appointment booking against the three showrooms, and the clothier channel with a stated
response time.

**Acceptance:** a member books a fitting and staff see it. The entitlement moves from available to
booked and cannot be claimed twice in a year. A lapsed membership shows the right state and the right
ask.

### M10 — Home, notifications, polish · 1.5 weeks · `mobile-build-verify`

The home screen pulling from everything built, push notifications for drop opens, preview completion
and fitting reminders, empty and error states audited across the app, and the compare-to-reference
passes.

**Acceptance:** a push arrives on a real device for each of the three types. Every screen in §7 has
been seen in all four states. Accessibility pass at the largest text size.

### M11 — Release · 1.5 weeks · `mobile-build-verify`

EAS production profiles, store listings, screenshots, privacy disclosures, the App Review notes
carrying the D1 reasoning, a closed test with real members, then submission.

**Acceptance:** real members complete the full journey on their own phones. At least one order and one
fitting come through the app. Then submit.

---

**Total: roughly seventeen to twenty-one weeks** for one developer to a public release. M4, M5 and M7
carry the most unknowns: real money, a rebuilt pipeline, and an image model.

---

## 11. How each milestone is proved

- **A compile is not a feature.** Type checks and a green build prove nothing about behaviour.
- **An animation is not a database write.** Anything touching money, access or persistence is verified
  by reading the backend and relaunching the app, not by watching the UI.
- **Two identities, always.** Every access check is demonstrated allowed for one account and denied
  for another.
- **Real devices.** A simulator is fine for layout and useless for camera, push, sign-in and payment.
- **Three passes, then stop.** Compare an implemented screen to its reference at most three times,
  fixing the highest-impact mismatch each pass, then report what is still different and why. Never a
  loop until identical; native usability beats pixel imitation.
- **Say what was not tested.** An unavailable device, provider or live payment goes in the report as
  unverified. Never claim a phone test that did not happen.

---

## 12. What we measure

Targets are hypotheses until measured. Fix the cohort and window before reading any rate.

| Event                    | Denominator                        | What it tells us                          |
| ------------------------ | ---------------------------------- | ----------------------------------------- |
| `onboarding_completed`   | accounts created                   | Whether the front door works              |
| `drop_viewed`            | members active in the window       | Whether the merchandising lands           |
| `preview_completed`      | members who started one            | Whether the pipeline is reliable enough   |
| `preview_to_product_tap` | previews completed                 | Whether previewing actually sells         |
| `checkout_opened`        | bags with at least one line        | Whether the browser handoff is acceptable |
| `order_paid`             | checkouts opened                   | The commercial outcome                    |
| `fitting_booked`         | members active in the window       | The relationship outcome                  |
| `return_within_14_days`  | members active in the prior window | Whether it is worth keeping               |

`preview_to_product_tap` and `order_paid` together answer the question this whole product exists to
answer: does letting a man see himself in a suit make him buy it.

---

## 13. Risks

| Risk                                              | Likelihood       | Cost                                    | Cheapest early test                                               |
| ------------------------------------------------- | ---------------- | --------------------------------------- | ----------------------------------------------------------------- |
| `eve/client` cannot stream under React Native     | medium           | The concierge tab, a week               | M0 spike 1                                                        |
| Order-first checkout blocked by store permissions | medium           | The whole commerce model                | M0 spike 3, plus a named key owner                                |
| App Review treats previews as digital content     | low, high impact | The billing model, a resubmission cycle | Review notes drafted in M0; guidelines re-read at submission      |
| 775 products sync badly, sizes wrong              | medium           | Members buy the wrong size              | Sample 20 against the live store in M3                            |
| Webhooks disabled silently after five failures    | medium           | Silent data drift                       | Reconciliation cron from day one in M4, with an alert             |
| Preview cost per member exceeds membership margin | medium           | The allowance model                     | Cost per render is measurable today; model it in M0               |
| Photo quality makes previews look poor            | high             | The core promise                        | Onboarding guidance and a reshoot path; watch `preview_completed` |
| Four months with no member feedback               | high             | Building the wrong thing well           | Installable build at every milestone, shown to the house          |
| Two Convex deployments drift apart                | low              | Confusion about the source of truth     | The web app is frozen; Circle is the only thing being changed     |

---

## 14. Not in the first release

- **A social feed, following, or member-to-member anything.** Not the product.
- **In-app card entry.** D1 forbids what it would gain, and PCI scope is not worth it.
- **Measurements captured on the phone.** Measurements belong to the clothier. A self-measured chest
  is worse than no chest. The app books the fitting instead.
- **Offline previews.** The pipeline is server-side by nature.
- **Tablet layouts.** Phone first.
- **A staff app.** Staff keep the web console.
- **Retiring the web app.** It hosts the agent and the share pages.

---

## 15. Appendix

### Repository layout after M1

```
NyoniMembers/
  convex/            the existing web backend, frozen
  src/               the existing Next.js app: staff console, share pages
  agent/             the concierge agent, hosted by the Next.js deployment
  circle/            Nyoni Circle
    app/             Expo Router routes, mirroring §7
    components/      the design system from §8
    convex/          the new backend and schema from §6
    lib/             clerk, convex, theme, format, woo
    assets/          fonts, icons, splash
  docs/              this plan and the ones it builds on
  .claude/skills/    the five skills that run the milestones
```

### Commands that will matter

```bash
pnpm --filter circle expo start --dev-client    # run against a development build
pnpm --filter circle exec convex dev            # the new backend
eas build --profile development --platform all  # the build you install once
eas build --profile production --platform all   # the build you submit
```

### Read before touching each area

- Product voice and the copy deck: `docs/01-brand-brief.md`
- Why memberships work this way: `docs/02-luxury-membership-research.md`
- What is deployed today: `docs/04-launch-checklist.md`, `README.md`
- The prompts being carried over: `convex/ai/prompts.ts`
- Repo conventions for Convex and the agent: `AGENTS.md`

### Sources verified on 21 September 2026

- Expo SDK 57 stable, SDK 58 beta: [expo.dev/changelog](https://expo.dev/changelog)
- `expo/fetch` streaming: [docs.expo.dev](https://docs.expo.dev/versions/latest/sdk/expo/)
- Clerk Expo quickstart and development-build requirements: [clerk.com/docs](https://clerk.com/docs/expo/getting-started/quickstart)
- Convex React Native client: [docs.convex.dev](https://docs.convex.dev/quickstart/react-native)
- App Store Review Guidelines 3.1.1, 3.1.1(a), 3.1.3, 3.1.3(b), 3.1.3(e), 4.8: [developer.apple.com](https://developer.apple.com/app-store/review/guidelines/)
- Google Play payments policy exemptions: [support.google.com](https://support.google.com/googleplay/android-developer/answer/9858738)
- WooCommerce order creation and `payment_url`: [woocommerce.github.io](https://woocommerce.github.io/woocommerce-rest-api-docs/#orders)
- WooCommerce webhook signatures and delivery behaviour: [hookdeck.com](https://hookdeck.com/webhooks/platforms/guide-to-woocommerce-webhooks-features-and-best-practices)
