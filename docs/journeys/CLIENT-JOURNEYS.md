# NYONI client journeys

18 October 2026. Proposed product specification derived from existing research. See README for scope, release boundaries and shared state rules. All journeys inherit those rules.

## C01 — Explore as a guest
**Release:** Core. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** First-time visitor; no account, photo or measurements required.

### Main path

1. Open Design your suit → see a complete studio look, brief service explanation and primary action.
2. Choose Start from a look or Start designing → create a durable guest draft.
3. Skip occasion or personal-photo entry → continue with studio model; optional steps remain accessible.

**Branches, failure and cancellation:** Browser storage blocked: retain the in-memory draft, explain that resume is unavailable, and offer download. Loading never leaves an empty screen; unavailable featured look has an alternative.

**Successful outcome:** Active guest design with stable draft ID; no order or request created.

**Acceptance:** Guest reaches fabric and review without mandatory login, photo upload or tour. First edit has an observable saved/pending state.

**Evidence basis:** SS01–SS02; avoid intrusive tours; Huntsman process clarity.

**Current prototype:** Partial: six-step guest tool exists; durable server guest draft and entry looks do not.

## C02 — Occasion, deadline and recommended looks
**Release:** Core. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** Guest or returning client starting a design.

### Main path

1. Choose occasion, optional event date and intended use → reveal a small explained selection of looks.
2. Inspect a recommendation → see its actual fabric/style defaults before choosing.
3. Apply a look → populate design; keep Browse all available and allow changing the occasion later.

**Branches, failure and cancellation:** Changing a recommendation must ask before replacing existing custom choices. An imminent event triggers concierge review, not an unverified delivery promise. Skipping date is allowed.

**Successful outcome:** A chosen base look plus recommendation reasons and optional event context.

**Acceptance:** Occasion changes the recommendations rather than only recording a label. Event readiness distinguishes delivery from required fitting time. Cancel leaves the existing suit unchanged.

**Evidence basis:** SS03; Huntsman service-led entry; deadline complaints across review sample.

**Current prototype:** Partial: occasion is recorded; recommendations and deadlines are absent.

## C03 — Browse and filter the fabric collection
**Release:** Core. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** Approved, sellable catalogue; unverified metadata excluded from filters.

### Main path

1. Open fabric collection → names, real swatches, codes and verified commercial status.
2. Apply colour/pattern/material/season filters or search → result count and active chips update.
3. Select fabric → specification and studio reference update together; personal image is marked stale if applicable.

**Branches, failure and cancellation:** No matches: show active filters and Clear all. Missing attributes are not guessed. Unavailable selection stays visible with replacement choices and requires re-confirmation before ordering.

**Successful outcome:** Exactly one selected approved fabric with catalogue version and source ID.

**Acceptance:** Result count matches the actual list. Opening details and Back preserve filters/scroll. Late image results cannot overwrite a later selection.

**Evidence basis:** SS02; HK02–HK04; PC02–PC04.

**Current prototype:** Partial: three real fabric choices and photo changes; full catalogue/filter/inventory handling absent.

## C04 — Inspect cloth and request a physical sample
**Release:** Core. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** Client opens a fabric card; sample service must be configured before showing Request sample.

### Main path

1. Open details → large actual swatch, source ID and verified material/care specifications.
2. Choose cloth → commit it and return to the same collection position.
3. If offered, request a sample → show cost/address requirements, validate delivery information, and create a separate sample request.

**Branches, failure and cancellation:** Unknown composition, price or availability is omitted or clearly awaiting confirmation. Closing inspection discards uncommitted choice. Failed sample submission preserves inputs and does not claim dispatch.

**Successful outcome:** Selected cloth or a separately acknowledged sample request; sample does not order a suit.

**Acceptance:** Swatch source matches code throughout. Sample status distinguishes requested, accepted and shipped. No personal address is requested for digital-only inspection.

**Evidence basis:** HK04; PC04; real-swatch confidence concerns.

**Current prototype:** Partial: swatch detail dialog exists; verified rich metadata and sample fulfilment do not.

## C05 — Shortlist and compare fabrics
**Release:** Core. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** At least two approved fabrics available; draft may already have a selected fabric.

### Main path

1. Add up to three fabrics to shortlist → visible count and removable saved entries.
2. Open Compare → show equally sized swatches and verified comparable specifications.
3. Choose one → update the suit, retaining the shortlist; return to browsing without losing position.

**Branches, failure and cancellation:** A fourth addition offers replacement, not a dead end. Missing values are shown as unconfirmed, not zero. Removed/unavailable catalogue entries remain identified but cannot be newly ordered.

**Successful outcome:** An informed cloth choice; shortlist remains part of the draft.

**Acceptance:** Removing an item updates both tray and comparison. Merely inspecting an alternative never changes the selected fabric.

**Evidence basis:** HK04 and PC04 information patterns; proposed NYONI comparison.

**Current prototype:** Absent in current local client tool; older v2 fabric-comparison experiment is not this implementation.

## C06 — Choose silhouette and tailoring details
**Release:** Core. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** Only tailor-approved base styles and combinations are offered.

### Main path

1. Inspect base style → see construction, included defaults and real reference views.
2. Select jacket/trouser detail → focused panel explains the choice and current value.
3. Apply → update compatible specification and relevant preview; Cancel returns without change.

**Branches, failure and cancellation:** Conflict opens an explanation naming affected options and proposed changes. Confirm applies the complete change atomically; Cancel retains everything. Changing base style never silently resets bespoke selections.

**Successful outcome:** A manufacturable configuration with explicit accepted dependencies.

**Acceptance:** Every selected option maps to a production ID. Reopening a detail restores its committed value. Conflicts cannot survive into quote approval.

**Evidence basis:** SS03–SS07; HK05; PC05–PC07; IN05.

**Current prototype:** Partial: one jacket construction, three lapels and fixed trousers; no dependency engine or broader silhouettes.

## C07 — Choose buttons, lining and monogram
**Release:** Core. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** Approved accessory catalogue and supported monogram rules.

### Main path

1. Inspect actual button/lining samples → source code and applicable size/coverage shown.
2. Choose accessories → update design summary and supported detail views.
3. Enter optional monogram → preview supported text, placement and thread style before applying.

**Branches, failure and cancellation:** Unsupported characters/length give specific help. If an interior image is unavailable, retain a real specimen and explain that placement is reviewed at fitting; do not pretend the closed jacket displays it.

**Successful outcome:** Exact accessory IDs and validated monogram specification.

**Acceptance:** Review/export and production record match the selected supplier components. A catalogue substitution requires explicit reapproval.

**Evidence basis:** SS04–SS05; HK06; Proper Cloth selected-button mismatch review.

**Current prototype:** Partial: real button/lining selection and text monogram exist; accurate interior/thread/placement rendering absent.

## C08 — Add a photo with informed consent
**Release:** Photo proof. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** Optional full-body route; studio model remains available. No processing starts before an explicit action.

### Main path

1. Choose See it on me → see suitable-photo examples, output limitations, provider and retention information.
2. Select own/authorized photo → validate file type, dimensions, size, person visibility and quality; strip EXIF.
3. Confirm crop and consent → show an input preview plus Generate my preview.

**Branches, failure and cancellation:** Blur, multiple people, hidden feet/face or unsupported image gives a retake reason. Invalid files are rejected safely. Cancel revokes temporary access and returns to studio. Selfie-only avatar is a separate future feature, never a body-accurate substitute.

**Successful outcome:** A privately scoped person-image asset and consent version; no generated result yet.

**Acceptance:** Uploading alone cannot trigger a paid generation. No public image URL, raw photo analytics or automatic marketing consent. Skipping photo preserves all garment choices.

**Evidence basis:** Proposed; personal-preview plan and provider capability research, not verified competitor VTON.

**Current prototype:** Absent; requires private upload/consent service.

## C09 — Generate and inspect a personal preview
**Release:** Photo proof. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** Valid photo, approved complete garment reference and explicit generation authorization.

### Main path

1. Press Generate → freeze design/reference version and create one idempotent job.
2. Queued/processing → show truthful status, useful wait guidance, and supported cancellation.
3. Success → show current personal image, Original/Studio/Personal controls, exact garment details and approximation label.

**Branches, failure and cancellation:** Provider refusal, timeout, quota or quality failure preserves original photo/draft and explains retry or studio fallback. Cancellation prevents a late result appearing as current. Do not invent progress percentages.

**Successful outcome:** A customer-specific result associated with one immutable configuration.

**Acceptance:** Job and image reads are owner-authorized. A rejected likeness/body/garment result is not silently displayed as successful. Generation never edits the underlying tailoring specification.

**Evidence basis:** Proposed; no competitor review proves identity or fit accuracy.

**Current prototype:** Absent; provider has not been selected or benchmarked.

## C10 — Change design after personal generation and compare looks
**Release:** Photo proof. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** At least one completed personal preview exists.

### Main path

1. Change fabric/lapel → studio reference updates immediately; personal image gets Previous design status.
2. Choose Update my preview → generate against the new immutable configuration.
3. Compare two saved looks → display each image with its own fabric/style labels and choose a design explicitly.

**Branches, failure and cancellation:** Rapid edits or out-of-order responses cannot mislabel images. Generating variant B never overwrites saved A. A retained personal view shows its historical labels until replaced.

**Successful outcome:** One chosen current configuration and a limited set of versioned private comparisons.

**Acceptance:** Select A, request B, edit to C, then receive B: result B cannot become current C. Deleting an image does not delete its garment specification.

**Evidence basis:** Current image-layer research plus proposed personal job lifecycle.

**Current prototype:** Absent for personal previews; studio switching exists.

## C11 — Recover, replace or remove a personal photo
**Release:** Photo proof. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** Photo uploaded, job active, failed or completed.

### Main path

1. Open photo controls → see Replace photo, Remove photo and related result choices.
2. Replace → cancel/revoke older work, validate new input and retain the garment design.
3. Remove → explain which private input/results will be deleted, execute deletion and return to studio.

**Branches, failure and cancellation:** Offline or delayed deletion shows pending status and retry rather than a false deleted receipt. Changing provider requires a fresh applicable disclosure/consent. Retention exceptions must be explicit.

**Successful outcome:** Controlled photo/result lifecycle with deletion receipt or clearly pending deletion.

**Acceptance:** Old image links expire or are revoked under the stated policy. Replacement cannot reuse another person asset or resurrect deleted output.

**Evidence basis:** Provider-retention research; proposed privacy requirement.

**Current prototype:** Absent.

## C12 — Save and resume a guest design
**Release:** Core. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** Guest editing on one browser; future durable draft service scoped separately from existing local storage.

### Main path

1. Edit → record draft version and visible save status.
2. Leave/return → offer Resume or Start new without silently discarding old work.
3. Resume → restore specification, shortlist, stage and supported views; revalidate changed catalogue/commercial data.

**Branches, failure and cancellation:** Storage denied/offline: explain scope and offer download. Stale server/local copies require a recoverable conflict choice. Expired photo does not invalidate the garment draft.

**Successful outcome:** Resumable design with clear local/server save scope.

**Acceptance:** Reload reproduces committed values. Save is never submission. Invalid old schema migrates safely or preserves a recoverable export.

**Evidence basis:** SS10; Hockerty restart complaint; existing local draft tests.

**Current prototype:** Partial: same-browser local draft works; durable guest service and conflict resolution absent.

## C13 — Create an account, link a draft and share a design
**Release:** Connected service. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** Client explicitly chooses cross-device save or sharing; guest design remains usable.

### Main path

1. Choose Save across devices → sign in/create account through approved authentication.
2. After authentication → ask which guest draft to link; retain source until save succeeds.
3. Share → create a revocable read-only design link with an explicit audience and expiry.

**Branches, failure and cancellation:** Login cancellation returns to draft. Account with an existing design requires merge/keep-both choice. Personal photos and measurements are excluded from shared links by default and require separate controls.

**Successful outcome:** Owner-linked design or explicitly scoped read-only share; no recipient message automatically sent.

**Acceptance:** Other accounts cannot enumerate or edit private drafts. Expiry/revocation works. A shared view cannot mutate the owner’s suit.

**Evidence basis:** SS10 was same-browser only; account/share are proposed.

**Current prototype:** Absent.

## C14 — Returning member and verified entitlement
**Release:** Connected service. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** Authenticated member; actual membership rules and source system configured.

### Main path

1. Open studio → fetch verified tier, benefit status and eligible options.
2. Choose included cloth or upgrade → display explicit inclusion, upgrade amount and final confirmation conditions.
3. Use annual benefit → reserve/redeem under approved policy with a visible receipt after success.

**Branches, failure and cancellation:** Unknown/disconnected entitlement is pending confirmation, not Available. No remaining benefit offers quote/concierge route. Concurrent redemption is server-controlled and retry-safe.

**Successful outcome:** A priced/eligible design and auditable benefit state; browsing alone does not redeem.

**Acceptance:** No entitlement derived from frontend labels. Quote, checkout and staff view agree; failed payment/redemption releases reservations according to real policy.

**Evidence basis:** Original NYONI membership intent; proposed business integration.

**Current prototype:** Absent; current tool makes no live entitlement claims.

## C15 — First-time client chooses a fit route
**Release:** Core. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** Client has a design but no verified fit profile.

### Main path

1. Open Fit → distinguish atelier fitting from guided remote measurements.
2. Inspect expectations → show what happens, what to bring and supported service locations.
3. Choose route → retain preference and continue to request/review without guessing a size from the preview.

**Branches, failure and cancellation:** Unsupported location/service routes to concierge review. Uncertain client may ask for help without completing fabricated measurements.

**Successful outcome:** Fit preference linked to design; not a confirmed appointment or approved body profile.

**Acceptance:** A personal image never implies verified measurements. Client can change route without losing design or overwriting a previous profile.

**Evidence basis:** IN appointment routes; HU process; PC08–PC09.

**Current prototype:** Partial: fitting preferences exist; service directory and live requests absent.

## C16 — Returning client reuses or updates verified measurements
**Release:** Connected service. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** Owner has a dated, staff-approved fit profile.

### Main path

1. Open profile → see verification date, source and fit preference.
2. Confirm whether body/comfort preferences changed → reuse profile or start a revision.
3. Submit changes → retain approved historical version and show pending review.

**Branches, failure and cancellation:** Outdated/incomplete profile requires human review under tailor-defined rules. Never silently apply unapproved revisions to an already released order.

**Successful outcome:** Explicit profile version associated with the design/quote.

**Acceptance:** Original values, revisions and reviewer are traceable. Selecting a stored profile requires authorization and cannot leak household/other-client measurements.

**Evidence basis:** Proper Cloth repeat-fit accounts; Oliver Wicks measurement guidance.

**Current prototype:** Absent.

## C17 — Guided remote measurements and photo-assisted fit review
**Release:** Connected service. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** Client selects supported remote service and agrees to its actual data use.

### Main path

1. Choose units and follow tailor-approved body/garment measurement instructions.
2. Enter values with diagrams and field-specific checks; optionally add fit/posture photos under separate consent.
3. Submit for staff review → receive requested clarification or an approved profile, never an automatic perfect-fit promise.

**Branches, failure and cancellation:** Uncertain values can be saved with an ask-for-help flag. Unit switching is lossless within defined rounding. Images used for fitting are not silently reused for generative previews.

**Successful outcome:** A provisional measurement submission, then an independently approved profile.

**Acceptance:** Plausibility rules come from a qualified tailor. Incomplete data cannot become approved. Movement preferences such as sitting or performance are recorded explicitly.

**Evidence basis:** HK profile entry; PC fit routes; OW/Sartoro qualitative reviews.

**Current prototype:** Absent; earlier v2 four-field experiment is not an approved measurement system.

## C18 — Request, book, reschedule or cancel a fitting
**Release:** Core. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** Actual service types/locations known. Request-first is the default until live calendar integration exists.

### Main path

1. Choose fitting service and location; inspect expectations and accessibility/contact needs.
2. Request-first: submit preferred timing/contact details → durable pending request ID. Live calendar only: choose available slot → review and confirm reservation.
3. Manage an acknowledged request/booking → reschedule or cancel with the correct confirmation state.

**Branches, failure and cancellation:** Slot taken at confirmation: keep inputs and offer alternatives. A preferred date is not a reserved slot. Failed submission gives retry without duplicate request. Reminders require approved channels/preferences.

**Successful outcome:** An acknowledged request OR an actual confirmed booking, labelled distinctly.

**Acceptance:** Real calendar receipt required for Confirmed. Time zones and event deadlines are explicit. Cancellation updates both client and staff records.

**Evidence basis:** IN07–IN11; HU03; Lanieri booking complaints.

**Current prototype:** Absent.

## C19 — Review the complete design and request a quote
**Release:** Core. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** Design passes catalogue/compatibility validation; fit may be pending but visibly so.

### Main path

1. Review exact materials, construction, personal details, fit route, preview version and pending confirmations.
2. Edit any section → return to review with new dependencies and preview freshness reflected.
3. Request review/quote → validate contact and consent, create durable request and show receipt with next action.

**Branches, failure and cancellation:** Changed material availability/terms requires acknowledgement. Failed send preserves draft; retry uses the same submission identity. No price, completion date or dispatch is invented.

**Successful outcome:** An immutable submitted design version and staff-owned request.

**Acceptance:** Request source IDs match export and staff view. Quote request is not purchase, redemption or booking. Download/print remains available independently.

**Evidence basis:** SS07–SS09; PC specifications; IN Save-to-bag confusion.

**Current prototype:** Partial: editable review, prepare, print and JSON export; no actual submission.

## C20 — Collaborate with a named concierge
**Release:** Core. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** Submitted request assigned to an available staff member.

### Main path

1. Open request → see actual owner, status and latest message/action.
2. Staff proposes fabric/style/fit change → client compares the before/after specification.
3. Accept or reject → version decision; material commercial changes trigger a new quote for approval.

**Branches, failure and cancellation:** No owner available: show awaiting assignment and real response expectation. Notification failure does not remove the in-app message. Unanswered case escalates under an actual operations rule.

**Successful outcome:** An agreed design and fitting/quote next step with a retained conversation.

**Acceptance:** No changes applied through informal chat alone. Staff sees the same current version; ownership transfer preserves case history.

**Evidence basis:** OW guidance; SS automated-loop complaints; Huntsman continuity.

**Current prototype:** Absent.

## C21 — Approve quote and optionally pay
**Release:** Commerce later. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** Staff-reviewed quote with actual pricing, availability and terms; payment connection is separate scope.

### Main path

1. Inspect itemized total, tax/shipping where applicable, benefit/upgrade adjustments and actual fit/delivery conditions.
2. Accept the exact quote version; if offered, choose deposit/full payment and review the payable amount.
3. Pay through configured provider → receipt only after verified confirmation; connect order to accepted specification.

**Branches, failure and cancellation:** Expired/revised quote requires reapproval. Declined/uncertain payment preserves design and avoids duplicate charges. Quote approval is not proof of payment or production release.

**Successful outcome:** Approved commercial commitment and, when applicable, confirmed payment/order.

**Acceptance:** Webhooks are idempotent and server-verified. Customer cannot pay an old quote to obtain new specifications. Discounts, benefits and refunds are auditable.

**Evidence basis:** Proposed commerce; research did not complete competitor purchases.

**Current prototype:** Absent; checkout intentionally disabled.

## C22 — Track production and manage an event deadline
**Release:** Connected service. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** Released order with actual production milestones.

### Main path

1. Open order → see only real stages such as approved, in production, quality review and shipped.
2. Review expected next milestone and event/fitting buffer; ask concierge for clarification.
3. If risk appears → receive realistic alternatives and decide on changes before they are committed.

**Branches, failure and cancellation:** Estimated dates are labelled estimates. Carrier delivery and garment readiness are different. Delayed events/production do not receive a fabricated automatic guarantee.

**Successful outcome:** Visible, accountable order progress with deadline risks and decisions.

**Acceptance:** Every milestone has a source/time. Staff cannot conceal an unresolved fit/quality issue by marking an item shipped. Event-risk communication is recorded.

**Evidence basis:** SS/IN/OW/Sartoro deadline reviews.

**Current prototype:** Absent.

## C23 — Receive the suit and assess first fit
**Release:** Connected service. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** Order delivered or collected; fulfilment receipt available.

### Main path

1. Open arrival guidance → inspect garment against approved specification and follow a short fit checklist.
2. Confirm acceptable fit or flag a specific jacket/trouser/detail issue.
3. If helpful, add consented photos and book/request a follow-up; staff acknowledges assessment.

**Branches, failure and cancellation:** Carrier Delivered does not auto-close fit review. Missing/damaged garment routes to fulfilment support, not a measurement change. Policy dates use the approved commercial rules.

**Successful outcome:** Client-approved fit or a linked open support case.

**Acceptance:** Original garment specification remains visible. Fit-check photos are private and purpose-scoped. Acceptance does not silently waive rights outside approved terms.

**Evidence basis:** Proper Cloth remake accounts; IN post-delivery gaps.

**Current prototype:** Absent.

## C24 — Request an alteration or remake
**Release:** Core service pilot. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** Delivered garment has a fit/detail problem.

### Main path

1. Choose issue by garment region; describe symptoms and add optional supporting photos.
2. Receive case ID/owner and clarification request; distinguish fit correction from a manufacturing mismatch.
3. Review proposed alteration/remake, costs/coverage, logistics and timing → accept remedy; track until client reassessment.

**Branches, failure and cancellation:** Repeated unsuccessful corrections escalate for human decision. Third-party tailor reimbursement requires explicit preapproval/status rather than an unexplained form. Event risk remains visible.

**Successful outcome:** Resolved case or an explicitly escalated alternative, not an automatically closed ticket.

**Acceptance:** Each correction versions measurements and links to the original issue. Follow-up checks actual fit before asking whether service was successful.

**Evidence basis:** Proper Cloth two-remake positive account; SS alteration and IN reimbursement complaints.

**Current prototype:** Absent.

## C25 — Cancel, return, exchange or request a refund
**Release:** Commerce later. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** Client/order qualifies under the actual published policy; no blanket custom-garment policy assumed.

### Main path

1. Open order support → show eligible actions and explain exclusions before collecting a request.
2. Choose action → see specific instructions, return label/pickup where supported and any approval conditions.
3. Track requested/approved/received/refunded separately; receive confirmation only from actual service/payment state.

**Branches, failure and cancellation:** Broken label or missed pickup has a direct retry and human escalation path. Pending refund is not Refunded. Cancellation after production release requires actual staff/policy review.

**Successful outcome:** Auditable cancellation/return/remedy with accurate financial status.

**Acceptance:** Partial refunds and exchanges reconcile with payments/benefits. No duplicate returns, lost labels or bot-only loops. Request cannot silently cancel unrelated garments.

**Evidence basis:** SS returns-loop complaints; IN post-sale friction; negative PC review checks.

**Current prototype:** Absent.

## C26 — Reorder from a successful suit
**Release:** Connected service. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** Client has an approved historical garment and fit profile.

### Main path

1. Choose Reorder → duplicate to a new draft, preserving history.
2. Review changed availability, prices, catalogue versions and profile freshness.
3. Keep the proven fit or request revisions; confirm new design/quote before ordering.

**Branches, failure and cancellation:** Discontinued cloth offers clearly different substitutes, never an invisible replacement. New measurements do not rewrite the original order. Archived personal photos are not silently restored.

**Successful outcome:** New approved order using explicitly chosen historical references.

**Acceptance:** Equivalent supplier ID is verified rather than inferred from a similar colour. Current policies/benefits apply visibly.

**Evidence basis:** Proper Cloth and OW repeat-order reviews.

**Current prototype:** Absent.

## C27 — Export or delete personal data and close an account
**Release:** Connected service. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** Owner requests data controls; authentication proportional to the action.

### Main path

1. Open privacy centre → separate designs, photos/results, fit records and account settings.
2. Choose export or deletion → explain scope, retention exceptions and effect on active service.
3. Confirm → provide actual completion/pending receipt; revoke shares/access and handle vendor deletion requests where supported.

**Branches, failure and cancellation:** Active-order retention is explained, not hidden. A pending downstream deletion is not called instantaneous deletion. Signed-out owner receives an appropriate identity-verification route.

**Successful outcome:** Traceable owner request with scoped access/deletion and documented exceptions.

**Acceptance:** Deletion and export do not expose another client. Cache, backups and vendor retention follow disclosed policy. Removing a photo does not accidentally cancel an order.

**Evidence basis:** Proposed privacy design; provider retention differs from NYONI storage.

**Current prototype:** Absent.

## C28 — Coordinate wedding or group designs
**Release:** Later optional. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** NYONI confirms group service and one organizer invites participants explicitly.

### Main path

1. Organizer defines shared style intent and event context → creates a group design brief.
2. Each participant accepts invitation and creates a private fit/photo profile while selecting permitted individual details.
3. Staff reviews group compatibility and per-person readiness; organizer sees consented status only.

**Branches, failure and cancellation:** Organizer cannot access members’ measurements/photos or authorize purchases for them without explicit permissions. Missing participants and deadline risks are visible; one order failure does not corrupt others.

**Successful outcome:** Coordinated but individually approved designs and fulfilment records.

**Acceptance:** Permissions distinguish shared styling from private personal data. Group consistency is explicit without promising identical fit or shared ownership.

**Evidence basis:** Wedding-order review pain points; proposed NYONI service.

**Current prototype:** Absent.
