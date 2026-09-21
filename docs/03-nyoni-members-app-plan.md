# Nyoni Members — product concept and rebrand plan

_How the Fitcheck codebase (Next.js 16, Convex, Clerk, Vercel Eve, OpenAI) becomes the members app for Nyoni Couture. Companion to `01-brand-brief.md` and `02-luxury-membership-research.md`. Prepared 21 September 2026._

---

## 1. Concept

**Nyoni Members** is the private app for Nyoni Couture's members and clients. It holds a member's measurements and fit history, tracks every commission from consultation to collection, schedules fittings, makes the annual suit allowance visible, and turns the member's Nyoni pieces (plus their own) into a digital wardrobe they can style, preview on their own photo, and discuss with a concierge. Staff use the same data from a small console.

Working title: **Nyoni Members** (matches the repository). Name candidates for the client to choose: "Nyoni Circle" (echoes the Circle Elite tier), "Nyoni Atelier", "The Nyoni Standard". Domain and app-store naming follow that decision.

**Positioning line (proposed):** "Your wardrobe, your measurements, your concierge. The house, in your pocket."

---

## 2. Who uses it

| Role | Description | Entry |
| --- | --- | --- |
| Client | Has bought ready-to-wear or one commission; no membership | Sign-up with email/phone; limited home |
| Signature member | A suit every six months; priority booking; concierge; alterations | Synced from WooCommerce or invited |
| Prestige member | A suit every quarter; fittings at their convenience; early access; events | Same |
| Circle Elite member | Invitation only; fully bespoke wardrobe; private surfaces | Invited by staff |
| Concierge / stylist (staff) | Answers requests, books fittings, records preferences | Staff role in Clerk |
| Master tailor / cutter (staff) | Records measurements and fitting outcomes; moves commissions through stages | Staff role |
| Admin | Membership sync, catalogue, spend guard, reports | Admin role (exists in Fitcheck) |

Menswear only. The onboarding "men's or women's wardrobe" choice is removed.

---

## 3. Feature map: Fitcheck → Nyoni Members

| Fitcheck today | Treatment | Nyoni Members |
| --- | --- | --- |
| Public landing page with pricing columns | **Replace** | Private sign-in page; membership is bought on nyonicouture.com or granted by staff |
| Sign-in / sign-up (Clerk) | Keep | Add phone (SMS) sign-in, since the house already talks to clients by SMS |
| Onboarding: photo, men's/women's, preferences | **Rework** | Photo (optional, private), fit and style preferences, occasions calendar, consent screens for photos and measurements |
| Wardrobe (scan photo → detect → select → extract cutouts) | Keep, rename "Add pieces" | Nyoni purchases and delivered commissions appear automatically as pieces; own clothes added by scan |
| Demo wardrobe seed (fictional pieces) | **Replace** | "The Collection": Nyoni's catalogue imported from WooCommerce; members can add any piece to a look, wishlist it or reserve in store |
| Outfits / Outfit Studio | Keep, rename "Looks" | Slots gain waistcoat, pocket square, tie/bow tie, cufflinks, overcoat; occasion field maps to weddings / business / black tie |
| Try-on renders on an avatar (standard / HQ, credit-priced) | Keep, **hide metering** | "Preview on you": one quality, included with membership, fair-use limit enforced silently; house spend guard stays |
| Stylist (Eve agent) | Keep, **re-persona** | "Concierge": the house stylist's assistant; knows measurements, allowance, next fitting, the Collection; hands off to a human |
| Lookbook (renders) | Keep | Lookbook |
| Billing (Clerk plans Free/Pro/Plus, credits) | **Replace** | Membership: tier, renewal date, allowance clock, member savings, benefits, "speak to your concierge" |
| Credits ledger (plan + non-expiring buckets) | **Repurpose** | Entitlement ledger: suit allowances granted per period (6-monthly / quarterly), consumed by commissions, never shown as a balance |
| Share render by token | Keep | Share a look with your concierge or a guest |
| Admin dashboard (credits, COGS, users) | **Extend** | Staff console: members, measurements, commissions, fittings, concierge inbox, catalogue sync, spend guard |
| Settings (avatar, prefs, delete data) | Keep | Add consent controls and data export; deletion keeps commission records the house must retain |
| — | **New** | Measurements profile with history and verification |
| — | **New** | Commissions tracker (stage stepper, next action, fittings, delivery estimate, rush) |
| — | **New** | Fittings & appointments (deep link to Square Appointments first; API later) |
| — | **New** | Party (wedding/group) commissions |
| — | **New** | Events & early access (member evenings, trunk shows, first look drops) |
| — | **New** | Wishlist and Reserve in store (replaces WishSuite for members) |
| — | **New** | Showrooms (three locations, hours, directions, "book here") |

---

## 4. Membership and entitlements

Tier definitions live in one shared file (replacing `convex/shared/credits.ts` plans) and are imported by client, backend and agent, following Fitcheck's existing single-source rule.

| Entitlement | Client | Signature | Prestige | Circle Elite |
| --- | --- | --- | --- | --- |
| Suit allowance | — | 1 per 6 months | 1 per quarter | Bespoke wardrobe (staff-managed) |
| Priority booking | — | Yes | Yes, "at your convenience" | Yes, "at your convenience" |
| Complimentary alterations | — | Qualifying orders | Qualifying orders | All |
| Member savings on MTM/bespoke | — | % TBC | % TBC | TBC |
| Personal concierge | — | Yes | Yes | Dedicated |
| Saved style profile & measurements | Basic | Yes | Yes | Yes |
| First look / early access | — | Higher tiers per site | Yes | Yes |
| Private events & member evenings | — | Higher tiers per site | Yes | Yes |
| Preview on you (try-on) | Trial | Included | Included | Included |
| Concierge AI stylist | Limited | Included | Included | Included |

**Billing source: decision required.**

- **Option A (recommended if memberships keep selling on the website):** WooCommerce (Subscriptions/Memberships) stays the system of record. The app reads membership status via the WooCommerce REST API (consumer key/secret) and receives `subscription`/`order` webhooks; Clerk handles authentication only. Fitcheck's "read subscription from the billing provider, grant per verified period, idempotent by period key" pattern transfers directly; only the provider changes.
- **Option B:** Clerk Billing with three plans (`signature`, `prestige`, `circle_elite`) as Fitcheck does today. Faster to build, but it duplicates billing and would need the website to stop selling memberships or to sync the other way.

Either way, Circle Elite is never self-serve: it is granted by staff.

---

## 5. Data model deltas (Convex)

Keep: `users`, `avatars`, `uploads`, `items`, `itemEmbeddings`, `outfits`, `renders`, `jobs`, `threads`, `proposals`, `usageCounters`, `dailyStats`, `stepStats`. Rename `creditLedger` → `entitlementLedger` (same shape, kinds become `allowance_grant`, `allowance_use`, `allowance_refund`, `admin`).

Change `users`: `plan` → `membership: { tier, status: active|lapsed|invited|none, startedAt, renewsAt, source: woocommerce|manual, wooCustomerId?, wooSubscriptionId? }`; drop `planCredits/packCredits/dailySpend` from the member-visible model (keep an internal `fairUse` counter for previews); `prefs` gains fit preferences and occasions; add `phone`, `showroomId`, `conciergeStaffId`.

New tables:

- `measurements`: `userId`, `takenAt`, `takenBy` (staff user id or "self"), `method` (hand|self|scan), `showroomId?`, `values` (per-garment map from the research schema), `posture`, `fitPreferences`, `notes`, `photoStorageIds[]`, `verifiedOnCommissionId?`, `supersededById?`. Index by user and takenAt. Never hard-deleted while a commission references it.
- `commissions`: `userId`, `partyId?`, `garmentType` (two-piece|three-piece|tuxedo|blazer|trousers|shirt|overcoat|other), `spec` (cloth, lapel, buttons, vents, lining, monogram, notes), `clothProductId?`, `stage` (consultation|measured|cloth_selected|pattern|cutting|first_fitting|forward_fitting|final_fitting|ready|delivered|cancelled), `stageHistory[]`, `entitlementRef?` (allowance used), `quotedUsd?`, `memberSavingsUsd?`, `rush: boolean`, `targetDate?` (event date), `estimatedReadyAt?`, `wooOrderId?`, `itemId?` (wardrobe piece created on delivery), `createdAt/updatedAt`.
- `fittings`: `userId`, `commissionId?`, `partyId?`, `kind` (consultation|measurement|first|forward|final|collection|virtual|alteration), `scheduledAt`, `showroomId | virtual`, `staffId?`, `status` (requested|confirmed|completed|cancelled|no_show), `outcome?`, `squareBookingId?`, reminders sent.
- `parties`: `ownerUserId`, `name`, `occasion`, `eventDate`, `sharedSpec`, `memberIds[]` (users or invitees by phone/email), `status`.
- `events`: `title`, `type` (member_evening|trunk_show|first_look|launch), `startsAt`, `showroomId?`, `tiers[]` (eligible), `capacity?`; `eventRsvps`: `eventId`, `userId`, `status`.
- `wishlist`: `userId`, `productId` (collection item), `note?`, `reservedAt?`, `showroomId?`.
- `collection`: the imported catalogue (`wooProductId`, `name`, `properName`, `category`, `priceUsd`, `attributes` mapped to `vItemAttributes`, `images[]`, `url`, `inStock`, `syncedAt`) with a search index.
- `conciergeRequests`: `userId`, `threadId?`, `kind` (styling|fitting|alteration|special), `body`, `status`, `assignedStaffId?`, timestamps.
- `showrooms`: static config (three locations) — a shared constant, not a table.

---

## 6. Route map

Member: `/home` (next fitting, active commissions, allowance clock, new arrivals, events) · `/wardrobe` · `/add` · `/looks` and `/looks/[id]` · `/lookbook` · `/collection` and `/collection/[slug]` · `/concierge` and `/concierge/[threadId]` · `/measurements` · `/commissions` and `/commissions/[id]` · `/fittings` · `/party/[id]` · `/membership` · `/events` · `/showrooms` · `/settings`.

Staff: `/staff` (today: late commissions, fittings today, open requests) · `/staff/members` and `/staff/members/[id]` (profile, measurements editor, commissions, notes) · `/staff/commissions` · `/staff/fittings` · `/staff/inbox` · `/staff/collection` (sync status) · `/staff/settings` (spend guard, tiers).

Public: `/` (sign-in with "membership enquiries" link to the website) · `/share/[token]`.

---

## 7. Design system changes

- Tokens: add the brand palette (onyx, ivory, charcoal, stone, brass, crimson) as semantic aliases on top of the shadcn neutral tokens; keep `--success`/`--warning`; retire `--credit`. Default theme dark, light available.
- Type: serif display (`--font-display`) for page titles, member names and garment names; grotesque for UI. Keep Fitcheck's 34/44px title scale and tracked 10px captions.
- Wordmark: "NYONI" in the display serif with a hairline rule; "Members" as a tracked caption beneath. Monogram "N" app icon.
- Components: `PageHeader`, `EmptyState`, `JobStepper` (→ `CommissionStepper` with dated stages), `CreditBadge`/`CreditQuote` (removed from member surfaces), new `AllowanceClock`, `FittingCard`, `MeasurementTable`, `TierBadge`.
- Landing page: replaced by a single sign-in screen with one full-bleed photograph; the marketing job stays on nyonicouture.com.
- Copy: apply the copy deck and tone rules in the brand brief; US spelling throughout, including the agent persona.

---

## 8. Content pipeline: taking the outfits from the site

1. **Import the catalogue** from the WooCommerce Store API (public, no keys): `GET /wp-json/wc/store/v1/products?per_page=100&page=N` plus `/products/categories`. Fields used: id, name, slug, permalink, categories, prices, short_description, images. `scripts/capture-nyoni.mjs` does this and writes `research/nyoni/woo-products.json`. If the Store API is disabled on the site, use the authenticated REST API (`/wp-json/wc/v3/products`) with a read-only consumer key.
2. **Map** each product to the wardrobe item schema: category (suit jacket, trousers, waistcoat, shirt, outerwear, shoes, accessories), colours (from the name: onyx, crimson, ochre…), formality (tuxedo/black tie → formal; suits → business; sweatsuits → casual), season (linen → summer; cashmere → winter), material, and the proper name. Keep the WooCommerce id for deep links to the product page and to "Reserve in store".
3. **Images:** product photography from the site is on the house's own domain and is the house's property, so the app can use it directly; run the existing cutout extraction only where a clean garment cutout is needed for try-on compositing.
4. **Seed:** replace `convex/demoWardrobe.ts` with a `collection` sync action (idempotent by `wooProductId`), scheduled nightly, plus a manual "sync now" in the staff console.
5. **Looks:** author six to ten house looks from the Collection (wedding, boardroom, black tie, summer linen, evening colour, weekend) as the first lookbook every member sees.

---

## 9. The concierge agent

- Persona: the concierge's assistant at Nyoni Couture; formal, warm, brief; US spelling; never mentions credits or AI costs; never promises delivery dates that are not in the commission record; offers a human handover ("Shall I ask your concierge?") whenever a request needs the house.
- Skills (markdown): keep `dress-codes.md` and `colour-pairing.md`; add `nyoni-house-style.md` (the construction vocabulary, cloth library, colour story, showroom facts) and `occasions.md` (weddings, business, black tie).
- Tools: keep `get_context`, `get_wardrobe`, `gap_analysis`, `get_weather`, `compose_outfits`, `start_renders`, `save_outfit`; retire `quote_renders` from the conversation; add `get_measurements`, `get_commissions`, `get_next_fitting`, `browse_collection`, `add_to_wishlist`, `request_concierge` (creates a `conciergeRequests` row).
- Guardrails already in Fitcheck (only propose owned pieces, verify ids, untrusted page context) stay unchanged.

---

## 10. Roadmap

| Phase | Scope | Done when |
| --- | --- | --- |
| **0. Foundations (1 week)** | Confirm brand visuals with the capture script; decide name, billing source, licence; obtain WooCommerce read keys; import Fitcheck into this repo | Tokens, fonts and copy deck approved; catalogue JSON in the repo |
| **1. Rebrand + Collection (2–3 weeks)** | Theme, wordmark, sign-in screen, copy; remove credits from member surfaces; Collection import and browse; house looks; concierge persona | A member signs in, sees the Collection and house looks, previews a look on their photo, chats with the concierge |
| **2. Membership + measurements (2–3 weeks)** | Tier model and ledger; WooCommerce sync or Clerk plans; membership screen with allowance clock; measurements profile with staff editor and history; showrooms | A Signature member sees "next suit unlocks on …"; staff record a measurement set; the member sees it |
| **3. Commissions + fittings (3 weeks)** | Commission tracker with stage stepper; fittings with Square deep links and reminders; rush flag; delivered commissions become wardrobe pieces; staff console | A commission moves through stages with dates and the member gets each change as a notification |
| **4. Circle + parties + events (2–3 weeks)** | Party module; events with RSVPs; first-look drops; Circle Elite private surfaces; data export and consent tooling | A groom builds a party, each member is measured, staff see the deadline board |
| **5. Later** | Square Appointments API; photo-based measurement capture; push notifications; iOS/Android wrappers | — |

Estimates assume one full-stack engineer plus design review, on the Fitcheck architecture.

---

## 11. Risks and open questions

1. **Licence of the Fitcheck source.** The repository has no LICENSE file and its README calls it "an educational application". Without a written grant, shipping a commercial derivative is not permitted. Either obtain permission from the author (Sonny Sangha) or treat the codebase as a reference architecture and re-implement. Decide before Phase 1.
2. **Membership prices and rules** (tier fees, savings percentage, "qualifying orders", allowance rollover, what the allowance covers) are not published; needed for the membership screen.
3. **WooCommerce access:** read-only REST keys, webhook setup, and which plugin runs memberships (WooCommerce Memberships/Subscriptions or another).
4. **Square Appointments:** deep links are enough for Phase 3; API access needed for in-app booking.
5. **Staff roles and workflow:** who records measurements, who owns concierge replies, response-time promise.
6. **Measurement capture in the house's own format:** confirm the exact fields the cutter uses so the schema matches the ledger they already keep.
7. **Privacy:** photos and measurements are sensitive personal data; consent copy, retention periods and staff access logging need sign-off.
8. **Name and store presence:** app name, domain, whether it ships as a web app first (recommended) and wraps native later.
9. **Fair-use limits for previews and concierge AI:** set per tier, enforced silently, reported in the staff console.
