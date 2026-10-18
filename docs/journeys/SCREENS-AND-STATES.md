# Screens, data and state contract

All statuses below describe target behavior, not deployed capabilities.

## Screen inventory

Screens are reusable surfaces: a dialog/drawer may satisfy a screen when its full task is supported. A toast alone cannot replace a requested fitting, measurement, support or upload journey.

| ID | Surface | Journeys |
|---|---|---|
| S01 | Entry / recommended looks | C01–C02 |
| S02 | Occasion / event context | C02 |
| S03 | Fabric browser / filters / empty results | C03 |
| S04 | Fabric inspection / sample request | C04 |
| S05 | Shortlist and comparison | C05 |
| S06 | Base styles / jacket and trousers | C06 |
| S07 | Focused tailoring detail / Apply-Cancel | C06 |
| S08 | Compatibility confirmation | C06–C07 |
| S09 | Buttons / lining / interior / monogram | C07 |
| S10 | Personal preview introduction / consent | C08 |
| S11 | Upload / validation / crop / retake | C08 |
| S12 | Generation queued / processing / cancel | C09 |
| S13 | Personal result / stale / retry / fallback | C09–C11 |
| S14 | Personal look comparison | C10 |
| S15 | Drafts / resume / conflict | C12 |
| S16 | Authentication / draft linking | C13 |
| S17 | Read-only shared design / expired access | C13 |
| S18 | Member benefit / verified eligibility | C14 |
| S19 | Fit-route selection / service information | C15 |
| S20 | Verified fit profile / revision | C16 |
| S21 | Measurement guide / units / clarification | C17 |
| S22 | Service/location / request vs booking | C18 |
| S23 | Live availability / booking management (conditional) | C18 |
| S24 | Editable design review / request contact | C19 |
| S25 | Submission receipt / pending / failure | C18–C20 |
| S26 | Concierge case / proposed change | C20 |
| S27 | Quote detail / revisions / approval | C21 |
| S28 | Payment / confirmation / pending (conditional) | C21 |
| S29 | Production / event risk / tracking | C22 |
| S30 | Delivery and first-fit checklist | C23 |
| S31 | Aftercare case / alteration / remake | C24 |
| S32 | Cancellation / return label / refund status | C25 |
| S33 | Historical suit / reorder review | C26 |
| S34 | Privacy / export / photo removal / account closure | C11/C27 |
| S35 | Group design and individual permissions (optional) | C28 |

Staff surfaces: A01 intake/case queue; A02 catalogue approval; A03 fit review; A04 quote/entitlement; A05 production release; A06 preview operations; A07 aftercare/finance; A08 access/privacy audit. Staff tools are role-restricted and are not client-visible shortcuts.

## Shared interaction contract

- Loading retains structure and previous valid state. Indefinite spinners offer a safe exit/retry or truthful pending state.
- Empty state distinguishes no data, no search matches, unavailable selection and expired access. Offer the relevant next action.
- Errors name the failed operation and preserve valid input. Retrying submission is idempotent; no duplicate order, generation, charge or benefit redemption.
- Back/Cancel discards provisional edits; committed design stays unchanged. If an operation is already committed externally, offer its actual cancellation workflow rather than pretending it never happened.
- Success is tied to a real durable transition. Save is not Submit; submitted request is not booked appointment; quote approval is not paid; shipped is not fit approved; approved refund is not refunded.
- Partial states name what is unconfirmed: metadata, quote, inventory, fit, image coverage or photo-generation freshness. They cannot silently become approved.
- Permission states let guests continue where possible. An expired session preserves a recoverable draft without exposing private images or measurements.
- Native dialog focus trap, keyboard labels, Escape where safe, focus return, screen-reader statuses, 44px touch controls and reduced motion apply throughout. On narrow screens, scrolling must not hide the decision or put essential actions under a fixed footer.
- Autosave reports its actual scope and status. Do not overwrite a saved server revision with stale local data without conflict handling.
- Notifications are separate records: queued, sent, delivered where provider-confirmed, failed. No generic toast proves an email/SMS was delivered. Transactional and marketing preferences remain separate.

## Canonical records

| Record | Required relationships and boundary |
|---|---|
| Design revision | Owner/guest scope; catalogue version; exact material/construction IDs; monogram; committed choices; compatibility decisions |
| Catalogue version | Approved source codes, metadata, eligibility, stock/price source and supported visual assets |
| Person photo | Owner; purpose-specific consent; provider disclosure; temporary/private storage; expiry/deletion state |
| Personal preview job/result | Person asset version + garment/design hash; provider job; private result; quality/freshness status; cancelled/expired/failed handling |
| Fit profile revision | Body/garment units and semantics; measurement provenance; staff approval/reviewer/date; no automatic promotion from generated photo |
| Service request/case | Immutable submitted design; requester contact; current owner; next action; communications and acknowledgement |
| Appointment | Request or confirmed reservation; service/location; zone; actual calendar state; cancellation/reschedule history |
| Quote revision | Exact design/profile references; verified totals; benefit/upgrade rules; expiry; acceptance history |
| Order/release | Accepted quote; approved production specification; applicable payment state; maker release and milestone history |
| Correction/remedy | Original order/case; issue; approved alteration/remake/return/refund; logistics; reassessment |
| Share/notification/privacy request | Scope, audience, expiry, actual completion state and audit links |

## State machines

**Design:** draft → submitted revision → reviewed → quoted → approved revision → released. Edits after submission create a new revision; edits after release require a controlled change request.

**Personal preview:** no photo → validated/consented → queued → processing → quality accepted/failed → current result. Any design/photo edit makes the result stale. Cancellation/deletion prevents late callback delivery. Expiry removes image access without erasing the garment specification.

**Fit profile:** provisional → needs clarification → staff approved → superseded. A revised profile cannot retrospectively rewrite a released garment.

**Service:** draft request → received → assigned → awaiting client/staff → completed/cancelled. A message may be sent while the case remains unresolved.

**Booking:** requested → awaiting confirmation OR held slot → confirmed → rescheduled/cancelled/completed. Calendar provider confirmation is required for Confirmed.

**Quote/order:** quote draft → offered → accepted/expired/superseded. Payment pending → confirmed/failed/refunded-partial/refunded. Production is separate: preflight → released → making → quality review → shipped/collected → fit review → accepted/correction open.

**Deletion:** requested → access revoked → primary deletion → downstream/backup processing → completed with disclosed exceptions. This is not an unsupported universal instant-delete promise.

## Cross-cutting acceptance scenarios

1. Start as guest, choose a cloth, reload, then authenticate: design survives and link conflict is explicit.
2. Apply a style incompatible with the current detail, cancel the proposed substitution: original specification is unchanged.
3. Request personal preview B, edit to C, then receive B after C: image B never claims to depict C.
4. Delete a photo during generation: late result remains inaccessible and does not resurrect input/output.
5. Revoke a share and request it from another session: design is inaccessible; private fit/photo data was never in the share.
6. Change units twice: measurements round according to the agreed rule and cannot become a different approved profile.
7. Revoke catalogue availability after quote: client receives an explicit new decision; paid/released orders are not silently substituted.
8. Submit a request twice during poor connectivity: one request/receipt exists and draft input remains recoverable.
9. Last calendar slot disappears before confirmation: no false booking, input preserved, alternatives shown.
10. Receive duplicate payment/provider callbacks: no duplicate charge, benefit redemption, order or photo result.
11. Submit a fit problem after delivery: original specification and exact profile remain inspectable through the correction.
12. Fail a return label/refund: case has an owner and escalation path, not a bot loop.
13. Returning client reorders discontinued cloth: original remains in history; replacement requires explicit approval.
14. Narrow viewport, keyboard and screen reader: each main client journey completes without inaccessible controls or clipped primary actions.
15. Guest or account storage unavailable: local/server scope and recovery choices are truthful.
16. Photo service unavailable: garment configuration and atelier handoff still work without a substituted person or fake result.

## Service boundaries

A full-body personal photo supports an illustrative preview, not verified size or guaranteed drape. Selfie-avatar creation, calibrated 3D body scanning and true personal back/360 views are not first-release promises. No automatic inference of sensitive personal traits is needed.

Prices, locations, membership entitlements, appointment supply, deadlines, alteration coverage, cancellation rights and retention are business-owned inputs. The interface must not invent them. Generative photo consent does not authorize marketing, training, identity recognition or unrelated fit-analysis processing.
