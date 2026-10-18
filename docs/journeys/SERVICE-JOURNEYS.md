# NYONI operational journeys

18 October 2026. Staff workflows required to make client promises real. These are proposed; no live service/backend integrations are claimed.

## O01 — Intake, assignment and concierge queue
**Release:** Core. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** A sample/fitting/design request is submitted.

### Main path

1. Validate and deduplicate request → place it in a visible staff queue with receipt timestamp.
2. Assign a named owner → record acceptance and an actual next action.
3. Clarify missing information or transfer ownership → preserve conversation and version history.

**Branches, failure and cancellation:** Unassigned/overdue cases escalate under configured staffing rules. Notification failure remains visible; no false emailed/delivered state.

**Successful outcome:** Owned request and traceable next action.

**Acceptance:** Every acknowledged request appears in the queue once. The client sees the same owner/status. A staff absence cannot orphan a case.

**Evidence basis:** Customer support/communication complaints.

**Current prototype:** Absent.

## O02 — Approve catalogue materials and compatibility
**Release:** Core. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** Supplier material or construction option is imported/changed.

### Main path

1. Review actual swatch, source code, production eligibility and verified metadata.
2. Approve dependencies, available views and material/price versions; flag uncertainty.
3. Publish a version → affected drafts/quotes are revalidated; withdrawn stock is not silently substituted.

**Branches, failure and cancellation:** OCR ambiguity cannot become a confirmed SKU. Missing image does not invent garment coverage. Updates to accepted quotes require controlled reapproval.

**Successful outcome:** Tailor-approved catalogue and a complete audit trail.

**Acceptance:** Every exposed option has provenance and an owner. Only supported combinations can be submitted as approved; all imagery is versioned.

**Evidence basis:** PC compatibility and selected-component complaints; original PDFs.

**Current prototype:** Partial extraction exists; approval/availability tools absent.

## O03 — Review measurements and approve fit profiles
**Release:** Core. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** Provisional measurements/photos or a revision is awaiting review.

### Main path

1. Inspect units, body-vs-garment semantics, provenance and client comfort goals.
2. Request clarification or approve corrected values with reason and reviewer.
3. Link an immutable approved profile version to the design/order; retain superseded versions.

**Branches, failure and cancellation:** Image-only or uncalibrated estimates cannot be promoted to verified measurements. Production already released requires a change request, not silent editing.

**Successful outcome:** Approved profile or clear client action required.

**Acceptance:** Only authorized fitting staff can approve. Measurement revisions explain the difference and cannot overwrite a different order/client profile.

**Evidence basis:** PC/OW/Sartoro fit-review findings.

**Current prototype:** Absent.

## O04 — Quote, entitlement and commercial review
**Release:** Core before live orders. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** A valid design and applicable business policies are available.

### Main path

1. Check actual availability, construction feasibility, fit status and event timing.
2. Resolve real membership eligibility and price breakdown; create expiring quote version.
3. Send for explicit client approval; revisions supersede earlier versions without losing history.

**Branches, failure and cancellation:** Unknown lead time or entitlement stays pending. An unavailable material produces an explicit alternative proposal. No invented discount, tax or annual benefit.

**Successful outcome:** Approved quote or a client-visible clarification request.

**Acceptance:** Client and staff totals match. Financial and entitlement adjustments have authorized owners and cannot be changed by client-side state.

**Evidence basis:** SS information clarity; NYONI membership requirements.

**Current prototype:** Absent.

## O05 — Release production and handle specification changes
**Release:** Connected service. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** Client accepted the current quote and prerequisites are satisfied.

### Main path

1. Perform production preflight against the approved specification/profile and applicable payment/benefit state.
2. Release immutable order package with exact IDs and accepted construction instructions.
3. Handle later change requests with feasibility, timing and commercial impact before new release.

**Branches, failure and cancellation:** Personal preview never becomes a measurement or BOM authority. Version mismatch blocks release. Late changes are not promised before maker confirmation.

**Successful outcome:** One controlled production version and auditable changes.

**Acceptance:** Factory/tailor receives the same IDs approved by client. A changed quote or photo result cannot automatically mutate a released order.

**Evidence basis:** Specification-mismatch reviews; proposed operational control.

**Current prototype:** Absent.

## O06 — Operate and review personal-preview jobs
**Release:** Photo proof. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** Consented generation job queued or flagged by a client/quality check.

### Main path

1. Verify owner, design asset version, eligible input and remaining generation budget.
2. Run bounded provider job → inspect output quality criteria and flag unusable results.
3. Deliver approved result, request retake or provide studio fallback; record operational metrics without raw-photo logging.

**Branches, failure and cancellation:** Provider outage, duplicate callbacks, stale result or deleted photo prevents current-result delivery. Staff image access is restricted and logged, not open to every concierge.

**Successful outcome:** Controlled personal-result lifecycle with accountable failure handling.

**Acceptance:** No cross-client cache or access. Identity/body/construction failures are not disguised as success. Provider deletion limitations remain disclosed.

**Evidence basis:** Proposed personal-preview quality/privacy plan.

**Current prototype:** Absent.

## O07 — Resolve aftercare, returns and payment remedies
**Release:** Core aftercare; finance later. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** Client opens a fit, quality, shipment or financial case.

### Main path

1. Triage issue and retrieve original accepted specification, profile, delivery and prior corrections.
2. Assign remedy with actual coverage, deadline, logistics and approval owner.
3. Confirm fulfilment/refund from the responsible system, then invite client reassessment and close or escalate.

**Branches, failure and cancellation:** Repeated fit failures, missing labels, unreceived reimbursements or unresolved refunds escalate to a person with authority. Customer must not repeatedly re-enter the same case.

**Successful outcome:** Accountable resolution with accurate financial/fit status.

**Acceptance:** Refund confirmation is distinct from approval; reopened cases retain history. Staff cannot mark payment refunded on an unverified message.

**Evidence basis:** SS support loops; PC remakes; IN reimbursement complaints.

**Current prototype:** Absent.

## O08 — Manage access, privacy and deletion requests
**Release:** Connected service; required before photo pilot. **Status:** Proposed target journey; not a verified end-to-end implementation.

**Entry:** Owner makes a data request or a retention job is due.

### Main path

1. Verify requester and enumerate scoped designs, photos, shares, jobs and fit records.
2. Apply deletion/export rules and valid retention exceptions; revoke active links and cancel affected jobs.
3. Track downstream provider requests and notify owner of actual completion/pending exceptions.

**Branches, failure and cancellation:** Failed storage/vendor deletion is retried/escalated, not hidden. Access investigations preserve necessary audit evidence without uncontrolled image copies.

**Successful outcome:** Completed owner request or transparent pending state.

**Acceptance:** Cross-account access tests, staff role checks, expiry and deletion checks pass before pilot. Legal/policy exceptions require documented review.

**Evidence basis:** Photo-provider retention research; proposed service control.

**Current prototype:** Absent.
