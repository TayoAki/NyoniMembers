# How luxury membership, clienteling and measurement tracking work

_Research notes for the Nyoni Members app, 21 September 2026. Sources at the end. Product names are examples of patterns, not recommendations to buy._

---

## 1. Why luxury houses run membership and private-client programmes

- A small share of clients drives a large share of revenue. Houses formalise this with **VIC ("very important client") programmes**: Cartier, Chanel, Hermès, Louis Vuitton and Bulgari run concierge teams that work alongside sales associates to curate experiences for high-spend clients. Farfetch's Private Client programme (with its Fashion Concierge) is gated by annual spend (about $12k / €12k / £10k a year).
- The programmes sell **access and time**, not discounts: early sight of collections, first right of refusal on limited pieces, private trunk shows and dinners, a named relationship manager, fittings "at your residence, on your yacht, or at the atelier", wardrobe logistics for travel and events.
- Loyalty design in luxury avoids mass-market "bronze/silver/gold" mechanics. Tiers are named aspirationally and the top tier is usually **invitation-only**. Hugo Boss frames loyalty as membership in an experience (styling consultations, show invitations, selective pricing); Neiman Marcus InCircle and Nordstrom's Nordy Club add early access and personal styling; "My Gucci" is app-led and personalised.

**Three models seen in the wild**

| Model | Who qualifies | Example | Nyoni today |
| --- | --- | --- | --- |
| Spend-qualified tiers | Annual spend threshold, recalculated yearly | Farfetch Private Client, Chanel Privilège | — |
| Paid annual membership with an allowance | Anyone who pays; entitlements scheduled across the year | Wardrobe-subscription tailors; Nyoni Signature and Prestige | Signature: a suit every 6 months; Prestige: every quarter |
| Invitation-only inner circle | Chosen by the house | Top tiers of most maisons | Circle Elite: "a fully bespoke wardrobe", invitation only |

Nyoni already runs the second and third models. The app's job is to make the entitlements tangible (a visible allowance clock, priority booking that is actually prioritised) and to give the inner circle something private.

---

## 2. Clienteling: the staff side of the same relationship

Luxury retail runs on **clienteling** software (Tulip, Proximity, BSPK, Clientbook, ChapsVision, ALPHA). The recurring feature set:

- **Client book / 360° profile:** contact preferences, purchase history across channels, sizes and measurements, style preferences, wishlist, occasions and important dates, notes and a full interaction log.
- **Appointments and events:** private appointment booking, trunk shows, launches and collector dinners with guest lists and RSVPs.
- **Outreach:** personal messages by SMS, WhatsApp, email or call, logged against the profile, with tasks and reminders for follow-up.
- **Assisted selling and AI:** look suggestions aligned to a client's style, product recommendations, milestone reminders (birthdays, anniversaries, renewal dates).

**Implication.** A members app that only faces the member will disappoint, because the promises (concierge, priority booking, scheduled suits) are fulfilled by staff. The plan therefore includes a small staff console from the first release: member list, profile, measurements, commissions, fittings and a concierge inbox.

---

## 3. Measurements: how tailoring houses record and reuse them

Bespoke and made-to-measure software (TailorSync, Atelierware, GarmentDesk, Orderry, ThreadNix, Dress Measurement) converges on the same design:

- **One saved profile per client, reused on every commission**, with **history** so the tailor can see how fit has changed over time.
- Measurements are stored **with context**: who took them, when, at which location, by which method, and which garment they were confirmed on. Photos and fit notes are attached.
- **Multiple trial fittings per order**, each with a recorded outcome and reminders, so the garment reaches the agreed fit before delivery.
- Garment-type-specific sets (jacket, trousers, waistcoat, shirt, coat) plus **fit preferences** (trouser break, lapel width, button stance, slim vs classic) and **posture notes**.
- Export to PDF/CSV for the cutting room.

**Capture methods**

| Method | Detail | Fit for Nyoni |
| --- | --- | --- |
| Hand-measured by the tailor | The house's own standard ("dozens of measurements taken by hand"); authoritative | Default; staff-entered in the console |
| Guided self-measure | Indochino: about ten minutes at home with a tape; fit saved for future orders; editable | Useful for remote members and shirts |
| Photo-based scan | Knot Standard's Fit app: front and side photos produce a pattern from 41 measurements plus posture; Mobile Tailor/3DLOOK: up to 70 points in under a minute | Later phase; needs vendor and consent review |

**Recommended measurement schema** (units in inches with cm toggle; every record versioned):

- **Jacket:** chest, waist, seat, shoulder width, half-back, back length, jacket length, sleeve length (left and right), bicep, wrist, neck.
- **Trousers:** waist, seat, thigh, knee, hem, outseam, inseam, front rise, back rise.
- **Waistcoat:** chest, waist, length.
- **Shirt:** neck, chest, waist, shoulder, sleeve (left and right), cuff, length.
- **Outerwear:** chest over jacket, sleeve over jacket, coat length.
- **Shoes:** size, width.
- **Posture and stance:** shoulder slope (left/right), stomach prominence, stance (erect/normal/stooped), arm rotation, head-forward; free-text tailor notes.
- **Fit preferences:** silhouette (slim/tailored/classic), trouser break, pleats, lapel style and width, button stance, vent style, cuff style, monogram.
- **Metadata:** `takenAt`, `takenBy` (staff id or "self"), `method` (hand/self/scan), `showroom`, `verifiedOnCommission`, `notes`, `photos[]`.

Rules that follow from the research: staff-taken records are authoritative; member self-entries are shown as "unverified until your next fitting"; the member always sees their own numbers; nothing is deleted, only superseded.

---

## 4. The commission lifecycle

Industry stages (nine steps in most descriptions): consultation → measurement → cloth selection → pattern drafting → cutting → canvas construction → first (baste) fitting → hand finishing and forward fitting → final fitting and collection. Typical timelines run 4–12 weeks; Nyoni quotes **about six weeks from the first fitting**, with rush arrangements for weddings and events.

What a member wants to see, in order: current stage, the next thing that needs them (a fitting, a cloth decision, a payment), the date of the next fitting, an honest delivery estimate, and who to talk to. What staff want: the same list across all open commissions, sorted by what is late.

**Occasions and group commissions.** Wedding parties are a core bespoke-menswear use case. Made-to-measure brands run "wedding party" flows: a party roster (groom plus groomsmen), one shared style specification, individual measurements collected in showroom or by guided video, tiered discounts by party size, and a timeline back-planned from the wedding date. Nyoni sells weddings as a headline occasion and charges a rush fee, so a **Party** module (roster, per-person measurement status, shared look, deadline warnings) is high-value.

---

## 5. Digital wardrobe and styling for luxury clients

- **Vêtir** ("the app for the 0.01% of shoppers and their stylists") combines a digital closet, AI look suggestions, stylist tools (a unified view of each client's closet, sourcing, commission tracking), calendar-synced outfits and packing lists. It positions itself as "the virtual version of the private showroom and atelier".
- The Fitcheck codebase already provides the technical core of that: garment detection and cutouts from a photo, a digital wardrobe with attributes, an outfit builder, try-on previews on the member's own photo, and an agentic stylist that only proposes from owned pieces.
- The luxury difference is in **what is not shown**: no credit meters, no daily caps, no "HQ render costs 3 credits". Members should experience styling as a service that is part of membership; the house keeps the spend guard internally.

---

## 6. Design principles for a luxury members app (derived)

1. **No visible metering.** Entitlements are stated as what you receive ("your next suit unlocks in March"), never as balances to spend.
2. **Concierge-first.** Every screen has a route to a person; the AI stylist is the concierge's assistant, not a replacement, and hands off gracefully.
3. **Truthful status.** Commission stages, fitting dates and delivery estimates come from staff-entered facts, not marketing timelines.
4. **Discretion.** Measurements and personal photos are sensitive: explicit consent, private by default, no sharing without the member's action, deletion on request, and staff access logged.
5. **Calendar-driven.** Fittings, events, allowance dates and the member's own occasions are the spine of the home screen.
6. **Quiet chrome, loud cloth.** The interface stays monochrome so garment colour and photography lead.
7. **Mobile-first, showroom-aware.** Members use it in a car on the way to a fitting; staff use it standing next to a client with a tape.
8. **Staff see what members see.** One data model, two surfaces.

---

## Sources

Private-client and loyalty programmes: https://www.whowhatwear.com/fashion/luxury/luxury-fashion-houses-very-important-clients-feature · https://us.fashionnetwork.com/news/Farfetch-extends-fashion-concierge-service-to-all-private-clients,1447992.html · https://www.fashionbi.com/insights/inside-the-world-of-luxury-retail-vip-clients-vic-experience · https://www.annefontaine.com/en_us/personal-shopping · https://sublimitylifestyle.com/en/exclusive-luxury-fashion-concierge-for-elite-clients/ · https://optculture.com/blogs/post/10-examples-of-luxury-fashion-loyalty-programs/ · https://www.trueloyal.com/blog/best-luxury-loyalty-programs · https://antavo.com/blog/luxury-fashion-loyalty-programs/ · https://www.growave.io/blog/secrets-of-luxury-loyalty-programs-examples · https://www.buildwithtoki.com/blog-post/luxury-loyalty-programs · https://www.keficommerce.com/blogs/best-fashion-loyalty-programs

Clienteling: https://www.tulip.com/clienteling/ · https://www.proximityinsight.com/customers/luxury/ · https://www.proximityinsight.com/resources/research/top-clienteling-apps-in-2025-which-is-right-for-you/ · https://www.clientbook.com/ · https://www.chapsvision.com/en-us/solution/clienteling-premium/ · https://storylab.ai/top-clienteling-software-tools-retail-brands/ · https://www.meetalpha.it/

Tailoring software and measurement capture: https://tailorsync.pro/bespoke-tailoring-software · https://www.atelierware.com/ · https://garmentdesk.com/blog/tailor-shop-management-software/ · https://orderry.com/tailor-shop-software/ · https://threadnix.com/ · https://dressmeasurement.com/en/ · https://wwd.com/menswear-news/mens-clothing-furnishings/knot-standard-launches-fit-app-1234889102/ · https://chainstoreage.com/knot-standard-takes-measurements-smartphone-snap · https://www.indochino.com/measurements · https://support.indochino.com/hc/en-us/articles/360038002894-How-does-our-process-work · https://sourceforge.net/software/tailoring/

Measurement sets and the bespoke process: https://www.studiosuits.com/blogs/articles/how-to-measure-yourself-to-get-the-ideal-custom-suit · https://www.bdtailormade.com/pages/custom-measurement-guide · https://www.oliverwicks.com/article/how-to-measure-for-suit · https://theartefact.com/made-to-measure-vs-bespoke-suits/ · https://ahandtailoredsuit.com/blogs/off-the-cuff/the-timeline-construction-of-a-bespoke-suit · https://www.ronandrich.com/blogs/news/suit-fitting-process · https://rippedandstitchedtailoring.com/our-blog/f/how-a-bespoke-mens-suit-is-made-the-complete-process · https://cuttingroombespoke.com/custom-bespoke-suits-tailor/2025/10/29/how-long-will-it-take-to-get-my-finished-garment · https://www.bhambis.com/how-to-commission-a-bespoke-suit/ · https://nyonicouture.com/size-guide/ · https://nyonicouture.com/made-to-measure/

Wedding parties: https://institchu.com/weddings · https://www.hockerty.com/en-us/men/groomsmen-suits/ · https://blacklapel.com/pages/weddings · https://www.hiveandcolony.com/services/weddings · https://www.indochino.com/weddings

Digital wardrobe for luxury: https://www.vetirapp.com/ · https://www.forbes.com/sites/roxannerobinson/2024/02/24/new-shopping-and-styling-app-vtir--aimed-at-luxurys-top-tier-clients/ · https://news.vetirapp.com/digital-closet-white-glove-luxury-wardrobe/ · https://femmetech.co.uk/vetir-the-app-for-the-top-0-01of-shoppers-and-their-stylists/ · https://dujour.com/style/vetir-app-launch/
