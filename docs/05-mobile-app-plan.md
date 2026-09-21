# Nyoni Circle — the mobile app plan

The master plan for **Nyoni Circle**, a new Expo app for iOS and Android. It is the house's private
members app: shop the drops, preview a piece on your own photo, take styling advice, keep a wardrobe,
save looks, manage your membership, and reach a clothier.

**This is a new product, not a port of the web app.** New Expo app, new Convex backend, a schema
designed around this journey rather than inherited from the Fitcheck wardrobe app it grew out of. One
thing carries over, and only because re-deriving it would be waste: the tuned AI image pipeline and
the concierge agent (§2).

**Status: proposed, 21 September 2026.** Nothing here is built. The existing web app stays live and
unchanged while this is built. Facts verified against a named source on 21 September 2026 are dated;
choices still open are in §6 with a recommendation and the evidence that would settle them.

### The decisions already taken

| Decision                                      | Choice                                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| How much of the existing system comes with it | A fresh app and a fresh backend. Only the AI pipeline and the concierge agent carry over.              |
| Where the code lives                          | A new `circle/` folder in this repository, as its own workspace package.                               |
| What the first release contains               | The full journey. Everything in the concept design ships at once.                                      |
| How the app's paid features are sold          | A digital subscription, **Atelier**, sold through Apple, Google and Stripe, modelled on Indyx Insider. |
| Where virtual try-on sits                     | Behind Atelier, as Indyx puts virtual selfies behind Insider.                                          |

**Two concerns, recorded once and then set aside.** Shipping the whole journey before any member sees
it means roughly four months without feedback and a larger first App Review surface; every milestone
in §11 therefore produces an installable build. And putting try-on behind a paywall gates the feature
most likely to sell a suit; the fourteen-day Atelier preview in §4 is the mitigation, and
`preview_to_order` in §13 is how we find out whether it was the right call.

---

## 0. How to read this

| Section                | Answers                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| §1 The product         | What Nyoni Circle is, who it is for, the journey it serves       |
| §2 New vs carried over | What is written fresh, and the one thing that is not             |
| §3 Two products        | The Circle and Atelier, and why they must stay separate          |
| §4 Free versus Atelier | Every feature, and which side of the line it sits on             |
| §5 Architecture        | How the phone, Convex, WooCommerce, the stores and the agent fit |
| §6 Decisions           | Nine choices, with recommendations and the evidence behind them  |
| §7 Data model          | The new schema, designed from this product                       |
| §8 Screens             | Navigation map, every screen, every state                        |
| §9 Design              | The house design system in React Native                          |
| §10 Access             | Who may do what, and where it is enforced                        |
| §11 Milestones         | Thirteen milestones to one release, each installable             |
| §12 Verification       | What "done" means and the evidence that proves it                |
| §13 Measurement        | What to count, and against what                                  |
| §14 Risks              | What could sink a milestone, and the cheap early test            |
| §15 Not in v1          | What is deliberately left out                                    |
| §16 Appendix           | Layout, commands, and what to read first                         |

The concept design is at `docs/assets/mobile-concept.webp`: six screens, a reference for tone and
layout only. It is not a source of measurements or final copy.

### The skills that run this plan

Installed at `.claude/skills/`. Each milestone in §11 names the one that runs it.

| Skill                        | Runs                                                          |
| ---------------------------- | ------------------------------------------------------------- |
| `mobile-plan-mvp`            | This document and any re-scoping of it                        |
| `mobile-design-flows`        | M1 design system, screen specs, visual references             |
| `mobile-auth-access`         | M2 identity, sessions, roles, account deletion                |
| `mobile-backend-memberships` | M3, M4 and M7: catalogue, orders, subscriptions, entitlements |
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

**The promise we never overstate.** A virtual try-on previews _appearance_. A clothier confirms _fit_.
Every preview surface says so in the interface, not only in a policy page. That is an honesty
requirement, and it is also why the app drives toward a fitting rather than away from one.

**Who it is for.** Members and prospective members of The Nyoni Circle: men who buy made-to-measure,
in or near Charlotte, Atlanta and Houston, plus remote members who travel in for fittings.

**What it is not.** Not a public storefront, not a social network, not a replacement for
nyonicouture.com. It is the members' door.

---

## 2. What is new, and the one thing that carries over

### Written from scratch

- **The Expo app.** Every screen, component and navigation decision, designed for a phone.
- **The Convex backend.** A new deployment with the schema in §7. No `planCredits`, no `packCredits`,
  no `creditLedger`, no Clerk billing. Those were Fitcheck's answers to Fitcheck's business.
- **Commerce.** Catalogue, drops, product detail, sizes, the bag, checkout and orders.
- **Subscriptions.** Purchase, entitlement and renewal state across three stores.
- **Service.** Appointments, the annual suit entitlement, the clothier channel.
- **Native capability.** Camera capture, permissions, push notifications, secure token storage.

### Carried over, deliberately

Roughly 800 lines of prompt engineering and model integration, because it is tuned, it works, and
re-deriving it means repeating weeks of image-model trial and error for an identical result.

| What                             | Where it is now                                    | Why it carries                                                                                                                                                                                                                    |
| -------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The try-on prompt                | `convex/ai/prompts.ts` → `renderPrompt()`          | Suit-aware layering, identity preservation, the full-body reconstruction rules that stop gpt-image-2 producing an enlarged head from a headshot, fit and drape language. Takes plain inputs, so it is already schema-independent. |
| Detection and extraction prompts | same file                                          | `detectionInstructions()` and `extractionPrompt()`: what counts as one garment, the matched-suit rule, flat-lay extraction on a transparent background.                                                                           |
| Model integration                | `convex/ai/openai.ts`                              | The gpt-image-2 edit call shapes, the transparency workaround, embeddings, and the hard-won constraint that **gpt-image-2 rejects `input_fidelity`**.                                                                             |
| Utilities                        | `convex/ai/colours.ts`, `convex/ai/image_input.ts` | Colour naming and image input normalisation.                                                                                                                                                                                      |
| The concierge                    | `agent/instructions.md`, `agent/tools/*`           | The persona, the voice, the tool surface. The Convex calls inside each tool are rewritten against the new schema.                                                                                                                 |

**What that honestly means.** The prompts and model calls move across almost unchanged. The plumbing
that reads and writes the old tables is rewritten. Two days per pipeline, not two weeks.

**What does not carry over:** `get_weather`, the sandbox tools (`bash`, `read_file`, `write_file`),
and the credit-quoting tools. A concierge that can run shell commands is a liability.

---

## 3. Two products, kept apart on purpose

Nyoni Circle sells two different things, and conflating them is the single most expensive mistake
available in this project.

|                  | **The Circle**                                                                                                                      | **Atelier**                                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| What it is       | The house relationship                                                                                                              | The app subscription                                                                                                                             |
| What you get     | A made-to-measure suit each year, priority fittings, complimentary alterations, member events, early access to drops, your clothier | Try-on previews, wardrobe analytics, HD images, enhanced flatlays, custom display, inspiration boards, styling from your clothier inside the app |
| Nature           | Physical goods and in-person services                                                                                               | Digital features inside the app                                                                                                                  |
| Tiers            | Client (free), Signature US$549/yr, Prestige US$749/yr, Circle Elite US$949/yr by invitation                                        | One tier, priced in the region of US$99 a year or US$14.99 a month                                                                               |
| Sold through     | WooCommerce on nyonicouture.com                                                                                                     | Apple in-app purchase, Google Play Billing, Stripe on the web                                                                                    |
| Apple's position | **Must not** use in-app purchase, per guideline 3.1.3(e)                                                                            | **Must** use in-app purchase, per guideline 3.1.1                                                                                                |

**Signature, Prestige and Circle Elite members get Atelier included.** That is allowed, and the
reason it is allowed is worth stating precisely. Guideline **3.1.3(b)** permits an app to let members
"access content, subscriptions, or features they have acquired in your app on other platforms or your
web site, **provided those items are also available as in-app purchases within the app**". Because
Atelier is genuinely purchasable inside the app at a fair price, a member who received it with a
Circle membership may use it. Remove the in-app purchase and that permission disappears with it.

**This is why the model the house picked is safer than the alternative.** Selling the digital
features only through WooCommerce would have been an external purchase unlocking app functionality,
which is what 3.1.1 exists to stop. Paying Apple and Google for the digital product is the price of a
clean position, and it costs 15 to 30 percent of Atelier revenue, not of suit revenue.

**Naming is a house decision.** "Atelier" is a placeholder chosen because it is a menswear word, it
does not collide with the four Circle tiers, and it reads as the house's workshop. Indyx calls theirs
Insider. Decide before M1; renaming a product after the store listings exist is tedious.

---

## 4. Free versus Atelier

Mirroring the Indyx split, mapped onto this house. The starred rows carry fair-use limits, as Indyx's
do.

| Feature                                              | Free | Atelier | Notes                                                         |
| ---------------------------------------------------- | ---- | ------- | ------------------------------------------------------------- |
| Unlimited pieces with automatic background removal * | ✓    | ✓       | The carried-over ingest pipeline                              |
| Unlimited looks *                                    | ✓    | ✓       |                                                               |
| Unlimited packing lists, wishlists and capsules *    | ✓    | ✓       |                                                               |
| Plan and track what you wear on a calendar           | ✓    | ✓       |                                                               |
| Sort your wardrobe by wear and cost-per-wear         | ✓    | ✓       |                                                               |
| The concierge, for styling questions                 | ✓    | ✓       | Indyx keeps 1:1 styling free; so do we                        |
| Reach your clothier                                  | ✓    | ✓       | Never paywall access to the house                             |
| Share a look                                         | ✓    | ✓       |                                                               |
| **Browse drops, product detail, bag, checkout**      | ✓    | ✓       | Never paywall the shop                                        |
| Book a fitting or consultation                       | ✓    | ✓       |                                                               |
| Try-on previews on your own photo                    | —    | ✓       | Indyx's "virtual selfies", the headline reason to subscribe   |
| Track a look with mirror selfies                     | —    | ✓       |                                                               |
| Wardrobe analytics dashboard                         | —    | ✓       |                                                               |
| Enhanced flatlays                                    | —    | ✓       |                                                               |
| HD wardrobe images                                   | —    | ✓       |                                                               |
| Customise your wardrobe display                      | —    | ✓       |                                                               |
| Inspiration boards                                   | —    | ✓       |                                                               |
| Styled by your clothier inside the app               | —    | ✓       | Indyx opens this to their community; a private house does not |

**Three rows sit with the Circle, not Atelier**, because they are physical or service benefits and
cannot be bought in an app at all: the annual made-to-measure suit, priority fittings with
complimentary alterations, and early access to drops with invitations to house events.

**Every new account gets a fourteen-day Atelier preview**, matching Indyx's approach and solving the
obvious problem with gating try-on: a man who cannot see himself in a suit has no reason to want one.
The preview is a flag we control, involves no store, and needs no card.

---

## 5. The architecture

```
                   ┌────────────────────────────────┐
                   │    Nyoni Circle (Expo)         │
                   │    iOS · Android               │
                   └──┬────────┬────────┬────────┬──┘
                      │        │        │        │
   Clerk session JWT  │        │        │        │  in-app browser,
                      ▼        │        │        │  no app credential
      ┌──────────────────┐     │        │        ▼
      │ Convex "circle"  │     │        │  ┌────────────────────────┐
      │ new deployment   │     │        │  │ WooCommerce order-pay  │
      │ data · storage   │     │        │  │  nyonicouture.com      │
      │ jobs · AI        │     │        │  └───────────┬────────────┘
      └──┬──────┬────────┘     │        │              │ signed webhook
         │      │              │        │              │ + reconcile cron
         │      │  REST v3 ────┼────────┼──────────────┘
         │      │              │        │
         │      │              │        ▼
         │      │              │   ┌──────────────────────┐
         │      │              │   │  RevenueCat          │
         │      │◀─────────────┼───│  App Store · Play    │
         │      │  signed      │   │  Stripe web billing  │
         │      │  webhook     │   └──────────────────────┘
         ▼      ▼              ▼
  ┌────────────────┐   ┌──────────────────────┐
  │ OpenAI via the │   │  concierge agent     │
  │  AI Gateway    │   │  /eve/v1 on Vercel   │
  └────────────────┘   └──────────────────────┘
```

**Six commitments in that diagram.**

1. **A new Convex deployment.** The live web app keeps its own backend and keeps working. No
   migration, no shared schema, no risk of breaking a running system to reshape it.
2. **The phone talks to Convex directly.** Same authenticated functions, no REST layer between, and
   realtime queries that make job progress truthful.
3. **WooCommerce takes money for anything physical, and the order is created before the member pays.**
   Convex creates it server-side with the member's id on it, then the app opens the returned pay URL.
4. **RevenueCat fronts all three stores for Atelier.** One entitlement across Apple, Google and Stripe
   web billing, one webhook into Convex, one place to read current state.
5. **Convex is the only judge of entitlement.** Never the client, never a store receipt read on the
   device. A single `hasAtelier(member)` function decides, and every gated query calls it.
6. **The phone holds no privileged key.** Clerk gives it a session token; Convex derives the member.
   The WooCommerce secret, the webhook secrets, the RevenueCat API key and the AI key stay server-side.

---

## 6. Nine decisions

### D1 — How money is taken

**Two routes, one per product, because Apple requires exactly this split.**

_Physical, through WooCommerce._ Guideline **3.1.3(e)**: "If your app enables people to purchase
physical goods or services that will be consumed outside of the app, you must use purchase methods
other than in-app purchase to collect those payments." Suits, alterations, fittings and Circle
memberships fall here. Selling them through in-app purchase would itself be a violation. Google Play
matches, exempting "purchase or rental of physical goods (such as groceries, **clothing**, housewares,
electronics)".

_Digital, through the stores._ Guideline **3.1.1**: in-app purchase is required "if you want to unlock
features or functionality within your app". Atelier unlocks app functionality, so it is sold by Apple
in-app purchase on iOS and Google Play Billing on Android, with Stripe serving the web.

_Linking out is allowed for a US app._ The 3.1.3 preamble bars steering members to another payment
method "except for apps on the United States storefront", and 3.1.1(a) confirms external-link
entitlements "are not required … in their United States storefront apps". Nyoni is a US house. **If
the app is later published to non-US storefronts, that restriction applies there** and the Circle
membership call-to-action needs region-aware handling. Note that in scope.

**Before submission:** put this two-product reasoning in the App Review notes, re-read the guidelines
that week, and consider a pre-submission question through App Store Connect. This is store policy,
not law, and the developer agreement is worth showing to counsel.

### D2 — How previews are rationed

**Atelier gets previews within a fair-use cap. Free accounts get them only during the fourteen-day
preview.**

Indyx advertises "unlimited outfit selfies" for Insider. Ours cost real money on every render, so
"unlimited" needs a cap behind it that no honest member will ever meet. Model the cost per render in
M0 and set the cap from that, not from a guess. State it in the interface as a number of previews
remaining, never as a currency, and never sell more.

A failed render never consumes the allowance.

### D3 — How checkout and purchase tracking work

**Convex creates the WooCommerce order first, then the app opens the pay URL.**

`POST /wp-json/wc/v3/orders` accepts `customer_id`, `line_items` and `meta_data`, so the member's id
is stamped on the order at creation. The response carries a `payment_url` of the form
`https://nyonicouture.com/checkout/order-pay/{id}/?key=wc_order_…`, opened with `expo-web-browser`.
The order is linked to a member before a card is entered. **No custom WordPress code is required.**

Three caveats on tracking:

- **Webhooks are the fast path, not the ledger.** WooCommerce fires `order.created` and
  `order.updated`, signed with HMAC-SHA256 in `X-WC-Webhook-Signature` over the raw body. Delivery
  runs on WordPress cron so it lags, there is no duplicate prevention, and **WooCommerce disables a
  webhook after five consecutive failures, silently**.
- **Reconcile on a schedule.** A Convex cron reads orders modified since the last sweep.
- **The backend has no webhook door yet.** `convex/http.ts` registers no routes at all today.

**The API key requirement goes up.** Creating orders needs a read-write WooCommerce key, not the
read-only one the launch checklist assumes. Name an owner in M0.

**One honest gap.** A member who buys on nyonicouture.com in an ordinary browser produces an order
with no member id. Match on billing email afterwards; it usually works and sometimes will not.

### D4 — How Atelier purchases are validated

**RevenueCat (`react-native-purchases`), with Convex as the system of record.**

It is the one library that covers all three of the channels this plan needs: Apple in-app purchase,
Google Play Billing, and web billing processed by Stripe, with a single entitlement shared across
them. It requires a development build, which this project needs anyway. Its free tier covers the
first US$2,500 a month of tracked revenue.

The rules that make this correct rather than merely working:

- **Never trust the device.** The app may show an optimistic state after a purchase; access is
  granted only once Convex has confirmed it.
- **Verify the webhook.** RevenueCat can send an authorization header and, better, HMAC-SHA256
  signing in `X-RevenueCat-Webhook-Signature` over the raw body. Use the signature.
- **Be idempotent.** RevenueCat states duplicates are possible in rare cases. Store the event id and
  process each once.
- **Reconcile after every event.** RevenueCat's own guidance is to call `GET /subscribers` after a
  webhook rather than deriving state from event types. Do that, and run a nightly sweep as well.
- **Model every state**: trial, active, cancelled but still paid, grace period, billing issue,
  expired, refunded. Access derives from current verified state, never from the last event seen.
- **Restoration must work.** A member who reinstalls, or signs in on a second device, gets their
  entitlement back without contacting anyone.

### D5 — Identity

**Clerk, with email code, Apple and Google.** The RevenueCat app user id is the Clerk user id, so an
entitlement follows the person rather than the device.

Apple's **4.8** requires an app using third-party or social login to also offer an equivalent
alternative limiting data collection to name and email, letting the member keep the email private,
and not collecting interaction data for advertising without consent. Clerk's email-code sign-in is a
candidate; verify it against the guideline text at submission, and implement native Sign in with
Apple on iOS regardless.

**Account deletion is an M2 deliverable.** Authenticate, enumerate owned pieces, photos, previews,
looks and conversations, delete the storage objects, revoke the session, retain what the house must
retain. Deleting an app identity cancels neither a WooCommerce membership nor an App Store
subscription. Say so on the screen, route to the concierge, and link to the store's own subscription
management.

### D6 — What we call things

The concept design says "The Nyoni stylist" for the AI and "Speak to a clothier" for the human. The
brand brief says the house says "concierge", never "stylist".

**The AI is "the concierge". The human is "your clothier".** Update the mockup copy, not the brand.

### D7 — What the first release is

**The full journey, in one public release.** Every milestone still produces an installable build.
Before the public listing, run a closed test with real members through TestFlight and Play internal
testing; that is a test cycle, not a separate release.

### D8 — Where the code lives

**A new `circle/` folder in this repository**, its own pnpm workspace package, containing both the
Expo app and its Convex backend. The existing Next.js app stays at the root with its own `convex/`.
Two deployments, two schemas, no interference.

### D9 — What Atelier costs

**Open, and a house decision.** Indyx charges US$12.99 a month or US$74.99 a year. A luxury house can
reasonably sit at or above that; the plan assumes roughly US$99 a year and US$14.99 a month as a
placeholder. Set it before M7, because store products, localised pricing tiers and the paywall copy
all depend on it. Whatever the number, Atelier must be priced as something a non-member would
genuinely buy, since that is what keeps 3.1.3(b) available (§3).

---

## 7. The data model

Designed from this product. A member is not a "user with a plan"; a piece is not an "item with
credits spent on it".

### Member, identity and entitlement

| Table            | Fields in outline                                                                                                                                                                                                                                                                    | Indexes                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| `members`        | `clerkId`, `email`, `name`, `imageUrl`, `role`, `phone?`, `homeShowroomId?`, `prefs {fit, avoidColours[], homeCity?, sizes?}`, `circle {tier, status, since?, renewsAt?}`, `atelierPreviewEndsAt?`, `onboardedAt?`, `createdAt`                                                      | `by_clerkId`, `by_email`           |
| `subscriptions`  | `memberId`, `entitlement` (`atelier`), `status` (`trial` \| `active` \| `grace` \| `billing_issue` \| `expired` \| `refunded`), `store` (`app_store` \| `play_store` \| `stripe` \| `promotional`), `productId`, `periodStart`, `periodEnd`, `willRenew`, `environment`, `updatedAt` | `by_member`, `by_status_periodEnd` |
| `purchaseEvents` | `eventId` (unique), `memberId?`, `type`, `payload`, `receivedAt`, `processedAt?`                                                                                                                                                                                                     | `by_eventId`, `by_member`          |
| `photos`         | `memberId`, `storageId`, `kind` (`portrait` \| `mirror` \| `reference`), `isPrimary`, `width`, `height`, `createdAt`                                                                                                                                                                 | `by_member`                        |
| `devices`        | `memberId`, `expoPushToken`, `platform`, `lastSeenAt`                                                                                                                                                                                                                                | `by_member`, `by_token`            |
| `allowance`      | `memberId`, `periodKey` (`YYYY-MM`), `previewsUsed`, `updatedAt`                                                                                                                                                                                                                     | `by_member_period`                 |

### Commerce

| Table      | Fields in outline                                                                                                                                                                               | Indexes                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `products` | `wooId`, `slug`, `name`, `priceUsd`, `salePriceUsd?`, `permalink`, `images[]`, `category`, `subcategory`, `attributes`, `inStock`, `variations[{wooId, size, inStock}]`, `minTier?`, `syncedAt` | `by_wooId`, `by_slug`, `by_category`, search on name and description |
| `drops`    | `key`, `title`, `subtitle`, `story`, `heroStorageId`, `state` (`available` \| `coming`), `opensAt?`, `minTier`, `productIds[]`, `order`                                                         | `by_state_order`                                                     |
| `bags`     | `memberId`, `lines[{productId, variationId, size, qty}]`, `updatedAt`                                                                                                                           | `by_member`                                                          |
| `orders`   | `memberId`, `wooOrderId`, `wooOrderKey`, `status`, `totalUsd`, `lines[]`, `paymentUrl`, `placedAt`, `paidAt?`, `source` (`app` \| `web`)                                                        | `by_member`, `by_wooOrderId`                                         |

### Wardrobe and styling

| Table             | Fields in outline                                                                                                                                                                                                                                                              | Indexes                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `pieces`          | `memberId`, `source` (`owned` \| `purchased` \| `house`), `productId?`, `storageId`, `size?`, `attributes {name, category, subcategory, colours, pattern, material, season, formality, fit, brand, description}`, `wearCount`, `costUsd?`, `status`, `searchText`, `createdAt` | `by_member_category`, `by_member_product`, search on `searchText` |
| `pieceEmbeddings` | `pieceId`, `memberId`, `embedding`                                                                                                                                                                                                                                             | vector index                                                      |
| `looks`           | `memberId`, `title`, `occasion?`, `slots {outerwear?, top?, suit?, bottom?, shoes?, accessories[]}`, `source` (`member` \| `concierge`), `createdAt`                                                                                                                           | `by_member`                                                       |
| `wears`           | `memberId`, `lookId?`, `pieceIds[]`, `wornOn`, `photoId?`                                                                                                                                                                                                                      | `by_member_wornOn`                                                |
| `boards`          | `memberId`, `title`, `images[{storageId, sourceUrl?}]`, `createdAt`                                                                                                                                                                                                            | `by_member`                                                       |
| `previews`        | `memberId`, `photoId`, `lookId?`, `productId?`, `storageId?`, `status`, `jobId?`, `shareToken?`, `createdAt`                                                                                                                                                                   | `by_member`, `by_look`, `by_shareToken`                           |

### Service

| Table           | Fields in outline                                                                                                                                 | Indexes                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `appointments`  | `memberId`, `showroomId`, `kind` (`fitting` \| `alteration` \| `consultation`), `requestedFor`, `status`, `note?`, `staffNote?`, `entitlementId?` | `by_member`, `by_showroom_status` |
| `entitlements`  | `memberId`, `year`, `kind` (`annual_suit`), `status` (`available` \| `booked` \| `in_progress` \| `delivered`), `appointmentId?`, `orderRef?`     | `by_member_year`                  |
| `conversations` | `memberId`, `title`, `sessionId`, `lastMessageAt`                                                                                                 | `by_member`                       |
| `jobs`          | `memberId`, `kind` (`ingest` \| `preview` \| `sync`), `status`, `steps[]`, `result?`, `error?`                                                    | `by_member_status`                |

### The one function everything gated calls

```ts
// circle/convex/model/entitlements.ts
hasAtelier(member, subscription, now) =
  (subscription?.status in { trial, active, grace, billing_issue } && subscription.periodEnd > now) ||
  (member.circle.tier in { signature, prestige, circle_elite } && member.circle.status === "active") ||
  now < (member.atelierPreviewEndsAt ?? 0);
```

Three ways in: bought it, a Circle membership includes it, or the fourteen-day preview is running.
Every Atelier query and mutation calls this. Nothing else decides.

### Constants that come across as values, not code

Tiers, prices, benefits, cloth grades, showrooms, concierge contacts, garment categories and outfit
slots are already correct in `convex/shared/membership.ts`, `convex/shared/house.ts` and
`convex/shared/wardrobe.ts`. Copy the values into `circle/convex/shared/`. Do not import across the
two backends.

### The rule that does not bend

Every query filters by `memberId` derived from the verified Clerk identity. No function accepts a
member id from the client. Ownership is checked before any read of a document by id.

---

## 8. Navigation and screens

Five tabs: **Home · Drops · Try-on · Concierge · Wardrobe.** The Circle sits behind the account
control in the header.

```
(public)
  index                    The house, what the Circle is, Sign in / Apply
  sign-in                  Email code · Apple · Google
  sign-up                  Same, with the review-and-approval note
(onboarding)               First run only
  photo                    Capture or choose a full-body photo, with guidance
  preferences              Fit, colours to avoid, home city, sizes
  ready                    Your fourteen-day Atelier preview starts now
(app)
  home                     Editorial hero · annual suit card · current drop · continue
  drops                    Available now / Coming soon · edits · member-access tiles
  drops/[dropId]           The edit: story, pieces, try this piece
  product/[productId]      Photos, price, cloth, sizes, try on, add to bag, ask the concierge
  bag                      Lines, sizes, totals, checkout
  orders                   Past orders and their status
  try-on                   The fitting room: pick a look or a piece, preview
  try-on/[previewId]       A finished preview: save, share, shop this piece, book a fitting
  concierge                Conversations
  concierge/[id]           Streaming chat, approvals, proposed looks
  wardrobe                 Owned · Saved looks · Boards · Saved to shop
  wardrobe/[pieceId]       One piece: photo, attributes, wears, cost per wear
  wardrobe/add             Camera or library → ingest job → review detected pieces
  wardrobe/analytics       The Atelier dashboard
  looks/new                Build a look from slots
  looks/[lookId]           A saved look: pieces, missing pieces, preview it
  calendar                 Plan and track what you wear
  atelier                  The paywall: what it unlocks, price, subscribe, restore, manage
  circle                   Membership card, tier, benefits, allowance
  circle/suit              The annual suit: status, book the fitting
  circle/appointments      Book and see appointments
  circle/clothier          Contact, showrooms, response time
  settings                 Account, subscription, notifications, sign out, delete account
```

**Every screen owes four states.** Loading uses a skeleton matching the final layout. Empty says what
to do next with one primary action. Failure says what failed and offers the retry. **Locked** says
what Atelier unlocks and what it costs, and is never a dead end.

**The paywall is a screen, not a modal afterthought.** Guideline compliance and decency both require
that price, billing period, renewal terms, what is included, restore purchases and a link to manage
the subscription are all present and legible before anyone taps buy.

---

## 9. The design system on native

| Role           | Dark, the default | Light              |
| -------------- | ----------------- | ------------------ |
| Background     | `#080808` onyx    | `#F2ECDF` cream    |
| Surface        | `#141414`         | `#F7F3EA`          |
| Foreground     | `#F2ECDF`         | `#080808`          |
| Primary, brass | `#CAA663`         | `#080808` on cream |
| Muted text     | `#A8A49B`         | `#6B665C`          |
| Border         | `#262626`         | `#D8D0BE`          |

**Type.** Bodoni Moda display, Manrope body, IBM Plex Mono captions, loaded with `expo-font`.

**Not negotiable on a phone.** A 16px side gutter. Touch targets at least 44pt. Safe areas everywhere,
including the full-bleed fitting room. Dynamic Type into the accessibility sizes without clipping.
Labels for assistive technology. Motion under 250ms, disabled under reduced motion.

**Media.** Product and preview images are 4:5 portrait on a cream tile in dark mode.

M1 produces the token file and nine component specs before any screen: Button, Tile, PieceCard,
ProductCard, SectionHeader, StateBlock, PriceRow, LockedBlock and TabBar.

---

## 10. Who may do what

| Action                                                  | Signed out | Free         | Atelier      | Circle member         | Staff              |
| ------------------------------------------------------- | ---------- | ------------ | ------------ | --------------------- | ------------------ |
| Front door                                              | ✓          | ✓            | ✓            | ✓                     | ✓                  |
| Wardrobe, looks, calendar, cost-per-wear                | —          | ✓            | ✓            | ✓                     | own only           |
| Browse drops, bag, checkout                             | —          | ✓            | ✓            | ✓                     | ✓                  |
| A drop gated to a higher Circle tier                    | —          | locked       | locked       | ✓ from that tier      | ✓                  |
| Book a fitting                                          | —          | consultation | consultation | ✓ priority            | creates for others |
| Try-on, analytics, HD, flatlays, boards, mirror selfies | —          | preview only | ✓            | ✓ included            | own only           |
| Annual suit entitlement                                 | —          | —            | —            | ✓ Signature and above | reads and advances |
| Set a member's Circle tier                              | —          | —            | —            | —                     | ✓                  |

Enforced in Convex, inside the function, from the verified identity and `hasAtelier`. A hidden tab is
a courtesy, not a control.

---

## 11. The milestones

Thirteen milestones to one public release. Each ends with an installable build and a demonstrable
outcome.

### M0 — Decisions and spikes · 1 week · `mobile-plan-mvp`

Settle §6, set the Atelier price and name, name an owner for the read-write WooCommerce key, model
the cost per render. Then four throwaway spikes:

1. **Streaming on device.** A bare Expo app opens a session against the live `/eve/v1` agent with a
   Clerk token and renders streamed tokens.
2. **Clerk into Convex.** A signed-in development build calls a function on the new deployment.
3. **Order-first checkout.** A script creates a WooCommerce order with member metadata and opens the
   returned `payment_url` on a device.
4. **A sandbox subscription.** A RevenueCat purchase completes in the App Store sandbox on a
   development build, and a signed webhook lands in a Convex endpoint.

**Acceptance:** all four run on a physical iPhone and a physical Android device, written up. **Stop
and re-plan if any of 1, 3 or 4 fails.**

### M1 — Backend skeleton, design system, shell · 1.5 weeks · `mobile-design-flows`

The `circle/` workspace, a new Convex deployment with the §7 schema, Metro configured, Expo Router
with five tabs, tokens, fonts, both themes, the nine base components. Static screens, explicit
fixtures.

**Acceptance:** five tabs navigate on both platforms, both themes, default and accessibility text
sizes, safe areas correct. Reference screenshots captured.

### M2 — Identity and onboarding · 1 week · `mobile-auth-access`

Clerk with secure token cache, email code, Apple and Google, the front door, sign-in triggers,
session restoration, sign-out, expired sessions, onboarding, the fourteen-day preview starting, and
account deletion end to end.

**Acceptance:** each provider verified independently on a real device. Kill and relaunch: still
signed in. Two identities cannot read each other's records, proved against the backend. Deletion
removes records and storage, revokes the session, and says truthfully what it does not cancel.

### M3 — Catalogue and drops · 1.5 weeks · `mobile-backend-memberships`

The scheduled WooCommerce sync into `products`, curated `drops`, the drops tab and drop screen.

**Acceptance:** twenty sampled products match the live store on price, stock and sizes. A tier-gated
drop is inaccessible to a lower tier, proved against the backend. The sync is safe to re-run.

### M4 — Product, bag, checkout, orders · 2 weeks · `mobile-backend-memberships`

Product detail with live stock, the bag, order creation through the REST API, the pay URL in an
in-app browser, the signed webhook endpoint, the reconciliation cron, the orders screen.

**Acceptance:** a real order placed end to end with real money, in WooCommerce with the member id on
it and in the app with the right status. A bad signature is rejected. A duplicate changes nothing.
Killing the app mid-checkout still reconciles. An out-of-stock size cannot be bought.

### M5 — Wardrobe and capture · 2 weeks · `mobile-build-verify`

The wardrobe, the piece screen, camera and library capture with permissions, upload, the rebuilt
ingest pipeline using the carried-over prompts, the job stepper.

**Acceptance:** a photo of real clothing becomes pieces, with truthful progress. Denied permission,
cancelled pick, failed upload and failed extraction each produce a clear state and a retry. A
purchased product becomes a piece when its order is paid.

### M6 — Looks, calendar, cost-per-wear · 1.5 weeks · `mobile-build-verify`

Build a look against the slot rules including the suit slot, save it, the wear calendar, cost-per-wear
sorting, and which pieces in a look are for sale rather than owned.

**Acceptance:** an invalid combination is refused with a reason. A saved look survives relaunch.
Deleting a piece removes it from its looks. Cost-per-wear matches a hand calculation. "Shop the
missing pieces" lands on the right products.

### M7 — Atelier: subscription and entitlement · 2 weeks · `mobile-backend-memberships`

Store products in App Store Connect and Play Console, RevenueCat configured with Stripe web billing,
the paywall screen, purchase, restore, the signed webhook into Convex, `GET /subscribers`
reconciliation, the nightly sweep, `hasAtelier`, and the locked states across the app.

**Acceptance:** a sandbox purchase on both platforms grants access, and it survives reinstall and a
second device. A cancelled subscription keeps access until the period ends, then loses it. A refund
revokes access. A duplicate webhook changes nothing. An out-of-order webhook does not regress state.
A Circle member gets Atelier without paying twice, proved against the backend. The fourteen-day
preview expires exactly once and cannot be restarted by reinstalling.

### M8 — The fitting room · 2 weeks · `mobile-build-verify`

The member photo, previews from a look or a single product, truthful progress, the original/preview
toggle, save, share, mirror-selfie tracking, and the fair-use cap from D2.

**Acceptance:** a real preview completes on a real device using the carried-over render prompt. A
failure returns the allowance. A free account past its preview sees the paywall, not an error. The
screen never implies the garment will fit.

### M9 — The concierge · 1.5 weeks · `mobile-build-verify`

The streaming chat, inline approvals and questions, proposed looks saved to the wardrobe,
conversations persisted, the agent's tools rewritten against the new schema.

**Acceptance:** a conversation streams on device, survives backgrounding, resumes after a dropped
connection. An approval blocks the action until answered. The concierge only names pieces and
products that exist.

### M10 — The Circle · 2 weeks · `mobile-backend-memberships`

The membership card, tier and benefits, the annual suit entitlement with its states, appointment
booking against the three showrooms, the clothier channel with a stated response time.

**Acceptance:** a member books a fitting and staff see it. The entitlement moves from available to
booked and cannot be claimed twice in a year. A lapsed membership shows the right state, the right
ask, and loses its included Atelier access on the next reconciliation.

### M11 — Atelier features · 2 weeks · `mobile-build-verify`

The analytics dashboard, enhanced flatlays, HD wardrobe images, custom wardrobe display, inspiration
boards, and styling from your clothier inside the app.

**Acceptance:** every feature in the Atelier column of §4 exists and is gated by `hasAtelier`. Each
shows a locked state to a free account that explains the price. Analytics numbers match a hand
calculation on a seeded wardrobe.

### M12 — Home, notifications, polish, release · 2 weeks · `mobile-build-verify`

The home screen, push for drop opens, preview completion and fitting reminders, a states audit, the
compare-to-reference passes, EAS production profiles, store listings with subscription metadata,
privacy disclosures, the App Review notes carrying the D1 reasoning, a closed test with real members,
then submission.

**Acceptance:** a push arrives on a real device for each type. Every screen in §8 seen in all four
states. Real members complete the full journey on their own phones, and at least one order, one
subscription and one fitting come through the app. Then submit.

---

**Total: roughly twenty to twenty-four weeks** for one developer to a public release. M4, M7 and M8
carry the most unknowns: real money, three stores, and an image model.

---

## 12. How each milestone is proved

- **A compile is not a feature.** Type checks prove nothing about behaviour.
- **An animation is not a database write.** Money, access and persistence are verified by reading the
  backend and relaunching the app.
- **A purchase screen is not an entitlement.** Access is proved by a Convex query returning data for
  a subscriber and refusing it for a free account.
- **Two identities, always.** Every access check demonstrated allowed for one account and denied for
  another.
- **Real devices.** A simulator is fine for layout and useless for camera, push, sign-in and payment.
- **Three passes, then stop.** Compare an implemented screen to its reference at most three times,
  fixing the highest-impact mismatch each pass, then report what remains and why.
- **Say what was not tested.** An unavailable device, provider or live payment goes in the report as
  unverified.

---

## 13. What we measure

| Event                  | Denominator                       | What it tells us                                       |
| ---------------------- | --------------------------------- | ------------------------------------------------------ |
| `onboarding_completed` | accounts created                  | Whether the front door works                           |
| `preview_started`      | accounts in their Atelier preview | Whether the hook lands                                 |
| `atelier_subscribed`   | accounts whose preview expired    | Whether the paywall converts                           |
| `atelier_renewed`      | subscriptions reaching renewal    | Whether it keeps its promise                           |
| `preview_completed`    | previews started                  | Whether the pipeline is reliable                       |
| `preview_to_order`     | previews completed                | **Whether seeing yourself in a suit makes you buy it** |
| `checkout_opened`      | bags with a line                  | Whether the browser handoff is acceptable              |
| `order_paid`           | checkouts opened                  | The commercial outcome                                 |
| `fitting_booked`       | members active in the window      | The relationship outcome                               |

`preview_to_order` is the number that decides whether gating try-on was right. If subscription revenue
rises while it falls, the house has traded suit sales for a small subscription, and this plan should
be revisited.

---

## 14. Risks

| Risk                                                       | Likelihood       | Cost                              | Cheapest early test                                              |
| ---------------------------------------------------------- | ---------------- | --------------------------------- | ---------------------------------------------------------------- |
| Gating try-on suppresses suit sales                        | medium           | The commercial case               | Watch `preview_to_order` from week one of the closed test        |
| `eve/client` cannot stream under React Native              | medium           | The concierge tab, a week         | M0 spike 1                                                       |
| Order-first checkout blocked by store permissions          | medium           | The commerce model                | M0 spike 3, plus a named key owner                               |
| Subscription state drifts from the stores                  | medium           | Members lose access they paid for | Reconcile on every webhook and nightly, from M7                  |
| App Review rejects the two-product split                   | low, high impact | A resubmission cycle              | Review notes drafted in M0; Atelier genuinely purchasable in-app |
| 775 products sync badly, sizes wrong                       | medium           | Members buy the wrong size        | Sample 20 against the live store in M3                           |
| WooCommerce webhooks disabled silently after five failures | medium           | Silent data drift                 | Reconciliation cron with an alert, from M4                       |
| Preview cost exceeds Atelier revenue per member            | medium           | The fair-use cap                  | Model cost per render in M0, cap from that                       |
| Photo quality makes previews look poor                     | high             | The core promise                  | Onboarding guidance and a reshoot path                           |
| Four months with no member feedback                        | high             | Building the wrong thing well     | An installable build at every milestone                          |

---

## 15. Not in the first release

- **A social feed, following, or member-to-member styling.** Indyx opens styling to their community; a
  private house does not.
- **In-app card entry.** D1 forbids what it would gain.
- **Measurements captured on the phone.** They belong to the clothier. The app books the fitting.
- **Reselling.** Indyx does resale; Nyoni sells its own cloth.
- **Offline previews.** The pipeline is server-side by nature.
- **Tablet layouts.** Phone first.
- **A staff app.** Staff keep the web console.
- **Retiring the web app.** It hosts the agent and the share pages.

---

## 16. Appendix

### Repository layout after M1

```
NyoniMembers/
  convex/            the existing web backend, frozen
  src/               the existing Next.js app: staff console, share pages
  agent/             the concierge agent, hosted by the Next.js deployment
  circle/            Nyoni Circle
    app/             Expo Router routes, mirroring §8
    components/      the design system from §9
    convex/          the new backend and schema from §7
    lib/             clerk, convex, revenuecat, theme, format, woo
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
- In-app purchases need a development build: [docs.expo.dev](https://docs.expo.dev/guides/in-app-purchases/)
- RevenueCat for Expo, covering Apple, Google and Stripe web billing: [revenuecat.com](https://www.revenuecat.com/docs/getting-started/installation/expo)
- RevenueCat webhook signing, duplicates and `GET /subscribers` reconciliation: [revenuecat.com](https://www.revenuecat.com/docs/integrations/webhooks)
- App Store Review Guidelines 3.1.1, 3.1.1(a), 3.1.3, 3.1.3(b), 3.1.3(e), 4.8: [developer.apple.com](https://developer.apple.com/app-store/review/guidelines/)
- Google Play payments policy exemptions: [support.google.com](https://support.google.com/googleplay/android-developer/answer/9858738)
- Indyx Insider pricing, US$12.99 monthly and US$74.99 annually as App Store in-app purchases: [apps.apple.com](https://apps.apple.com/us/app/indyx-wardrobe-outfit-app/id1599179405)
- WooCommerce order creation and `payment_url`: [woocommerce.github.io](https://woocommerce.github.io/woocommerce-rest-api-docs/#orders)
- WooCommerce webhook signatures and delivery behaviour: [hookdeck.com](https://hookdeck.com/webhooks/platforms/guide-to-woocommerce-webhooks-features-and-best-practices)
