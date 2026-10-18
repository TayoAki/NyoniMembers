# Nyoni Atelier — build contract

_18 October 2026. The implementation contract for the suit experience specified in `docs/journeys/` (28 client
journeys C01–C28, 8 operational journeys O01–O08, 35 client screens S01–S35, 8 staff surfaces A01–A08). It names
the routes, tables, shared constants, Convex functions and file ownership so that work on different domains can
proceed in parallel against one spec. Where this document and the journey spec disagree, the journey spec's
acceptance criteria win and this document is wrong; say so in your report._

The surface is called **the Atelier** (the house's own word: "Private Atelier Experience"). Code namespace:
`atelier`. Member-facing voice: the brand brief (`docs/01-brand-brief.md` §3). US English. "Concierge", "cloth",
"commission", "fitting", "showroom", "the house". Never "credits", "AI", "generate", "upload", "render", "user".

---

## 0. Decisions that shape everything

| Question | Decision |
| --- | --- |
| Where does it live? | This Next.js + Convex app. Client surface in route group `src/app/(atelier)/`, staff surface under `src/app/(app)/admin/atelier/`. The "frozen while Circle is built" note in `AGENTS.md` is superseded for this work. |
| Who can design? | Anyone. A **guest** is identified by a `guestKey` (random 32-hex, minted client-side, kept in `localStorage["nyoni.atelier.guest"]`). A signed-in **client** owns drafts by `userId`. Linking a guest draft to an account is explicit (C13). |
| Who is staff? | `users.role === "admin"` (existing) plus a new optional `users.staffRoles: StaffRole[]`. Admins hold every role. `requireStaff(ctx, role)` enforces. |
| The cloth catalogue | Real: 32 cloths from the house's WooCommerce "Bespoke Clothing" category (`research/nyoni/atelier-cloths.json`), with the **photographs of the mill books** the store publishes. The photographs are of books, not flat swatches, so each cloth carries a **representative shade** (`hex`) that is `shadeConfirmed: false` until staff confirm it (O02). The UI must label it "representative shade". |
| The studio figure | A parametric SVG illustration (`SuitFigure`) drawn in hairlines, filled with the cloth's representative shade, that changes with every spec choice. It is labelled "Studio illustration". It is not a photograph and never claims to be. |
| Personal previews | Real generation through the existing OpenAI image-edit path (`gpt-image-2`, `convex/ai/openai.ts` conventions) when `OPENAI_API_KEY` or `AI_GATEWAY_API_KEY` is set on the deployment; otherwise the feature reports itself unavailable truthfully. Budget: `ATELIER_LIMITS.previewsPerDay` per owner, no credits. |
| Payments | Not connected. Quotes can be accepted; `orders.payment.state` is recorded by staff from the house's real payment system with a reference (O04/O05). The UI never shows "Paid" without `payment.state === "confirmed"`. |
| Calendar | Not connected. Fittings are **request-first** (C18). `status: "confirmed"` requires staff to record a `calendarRef` (Square Appointments booking id) and a confirmed start time. |
| Notifications | Recorded, not sent. `atelierNotifications` rows are `queued` and the UI says "We will email you at …" only as intent; the in-app case is the source of truth. A sender can be added later without changing the model. |
| Deletion | Multi-step and truthful: `requested → access_revoked → primary_deleted → downstream_pending → completed`, with disclosed exceptions (active order retention). |

---

## 1. Routes

### Client (route group `(atelier)`, no sign-in required, no onboarding gate)

| Route | Screen(s) | Journeys | Notes |
| --- | --- | --- | --- |
| `/atelier` | S01 Entry / recommended looks, S02 occasion (inline) | C01, C02 | Persuade-mode entry. "Start designing" creates a draft and goes to the studio. "Start from a look" applies a look. |
| `/atelier/design/[draftId]` | redirect to the first incomplete step | | |
| `/atelier/design/[draftId]/[step]` | the studio: `occasion` S02 · `cloth` S03/S04/S05 · `style` S06/S07/S08 · `details` S09 · `preview` S10–S14 · `fit` S19/S22 (entry to fit route) · `review` S24 | C02–C12, C14, C15, C19 | `layout.tsx` holds the persistent stage + step rail; `[step]/page.tsx` swaps the panel. |
| `/atelier/drafts` | S15 drafts / resume / conflict | C12 | Local index + server drafts; conflict choice when both exist. |
| `/atelier/link` | S16 draft linking after sign-in | C13 | Lists guest drafts in this browser and offers Link / Keep separate / Merge choice. |
| `/atelier/shared/[token]` | S17 read-only shared design / expired | C13 | Public, no shell chrome beyond wordmark. Never includes photos, measurements, contact. |
| `/atelier/membership` | S18 member benefit / verified eligibility | C14 | Signed-in only; reads `users.membership`; reservation/redemption state. |
| `/atelier/fit` | S19 fit route, S20 fit profile / revision, S21 measurement guide | C15–C17 | Signed-in for profiles; guests see the routes and are asked to sign in to save measurements. |
| `/atelier/fittings` and `/atelier/fittings/[appointmentId]` | S22 request vs booking, S23 (conditional, shows only when staff confirm) | C18 | |
| `/atelier/requests` and `/atelier/requests/[caseId]` | S25 receipt / pending / failure, S26 concierge case & proposed change, S27 quote detail / approval, S28 payment state (conditional) | C19–C21 | Guest access by `guestKey`; signed-in by ownership. |
| `/atelier/orders` and `/atelier/orders/[orderId]` | S29 production / event risk, S30 delivery & first-fit checklist, S31 aftercare case, S32 cancellation / return / refund, S33 reorder | C22–C26 | |
| `/atelier/privacy` | S34 privacy centre | C11, C27 | Photos, results, designs, fit records, account closure. |
| `/atelier/groups`, `/atelier/groups/[groupId]`, `/atelier/groups/join/[inviteToken]` | S35 | C28 | Organizer and participant views; staff review in A01. |

### Staff (inside the signed-in `(app)` shell, `requireAdminPage()` on every page, role checks on every function)

| Route | Surface | Journeys |
| --- | --- | --- |
| `/admin/atelier` | A01 intake / case queue (filters: unassigned, mine, overdue, awaiting client) | O01 |
| `/admin/atelier/cases/[caseId]` | case detail: messages, proposals (O01/C20), quote composer (A04/O04), appointment confirmation (C18), sample fulfilment (C04) | O01, O04 |
| `/admin/atelier/catalogue` | A02 catalogue approval: entries, shade confirmation, withdraw, publish version | O02 |
| `/admin/atelier/fit` and `/admin/atelier/fit/[profileId]` | A03 fit review | O03 |
| `/admin/atelier/quotes` | A04 quotes awaiting offer / expiring | O04 |
| `/admin/atelier/production` and `/admin/atelier/production/[orderId]` | A05 preflight, release, milestones, payment record, change requests | O05 |
| `/admin/atelier/previews` | A06 preview operations (jobs, quality flags, access log) | O06 |
| `/admin/atelier/aftercare` and `/admin/atelier/aftercare/[correctionId]` | A07 aftercare, returns, refund confirmation | O07 |
| `/admin/atelier/privacy` | A08 privacy requests, staff roles, audit log | O08 |

Every link goes through `routes.atelier.*` / `routes.staffAtelier.*` in `src/lib/routes.ts`.

---

## 2. Identity and access (`convex/atelier/access.ts`)

```ts
type Actor = { user: Doc<"users"> | null; guestKey: string | null };
resolveActor(ctx, guestKey?: string): Promise<Actor>              // never throws
ownerFilter(actor): { userId } | { guestKey }                        // which index to read
requireDraftAccess(ctx, draftId, guestKey?): Promise<{ draft, actor }>  // NOT_FOUND when neither matches
requireOwned<T extends { userId?: Id<"users">; guestKey?: string }>(doc, actor, what): T
requireStaff(ctx, role?: StaffRole): Promise<Doc<"users">>          // admin passes any role; FORBIDDEN otherwise
audit(ctx, { actor, action, targetTable, targetId, meta? })          // writes atelierAuditLog
```

Rules:

- A document is owned when `doc.userId === actor.user._id`, or (no user match) `doc.guestKey === actor.guestKey`. Guest keys are bearer secrets; never return a guest key from any query.
- Linking (C13) sets `userId` and clears `guestKey` on the draft and on everything that hangs off it (photos, preview jobs, cases, appointments).
- Staff reads of a client's photo or result (`atelierPersonPhotos`, preview results) are audited with `action: "photo.view"`. Only `preview_ops` or admin may read them (O06).
- Public shared views (`shares.getByToken`) return a `SharedDesignView` that contains the spec, catalogue labels and the studio figure inputs only.

Staff roles (`convex/shared/atelier/enums.ts` → `STAFF_ROLES`): `concierge`, `fitter`, `finance`, `operations`, `preview_ops`, `privacy`.

---

## 3. Shared constants (`convex/shared/atelier/`, owned by the lead; import, do not duplicate)

| File | Exports |
| --- | --- |
| `enums.ts` | `STAFF_ROLES`, `OCCASIONS` + `OCCASION_LABELS`, `STUDIO_STEPS` + `STEP_LABELS`, `DRAFT_STATUSES`, `CASE_KINDS`, `CASE_STATUSES`, `APPOINTMENT_SERVICES`, `APPOINTMENT_STATUSES`, `QUOTE_STATUSES`, `ORDER_STATUSES`, `PAYMENT_STATES`, `CORRECTION_KINDS`, `CORRECTION_STATUSES`, `FIT_PROFILE_STATUSES`, `PREVIEW_STATUSES`, `PHOTO_STATUSES`, `PRIVACY_KINDS`, `PRIVACY_STATUSES`, `GROUP_STATUSES`, `PARTICIPANT_STATUSES`, `NOTIFICATION_STATUSES`, `FIT_ROUTES`, label maps for each, and `ATELIER_LIMITS` |
| `spec.ts` | `SuitSpec` type and `vSuitSpec`-compatible shape, `GARMENTS`, every option list with `code`, `label`, `description`, `productionId`; `DEFAULT_SPEC`, `specHash(spec)`, `applyChange(spec, patch) → { spec, conflicts }`, `validateSpec(spec) → string[]`, `describeSpec(spec, catalogue) → lines`, `specSummary(spec)` |
| `cloths.ts` | `CLOTH_SEED: ClothSeed[]` (generated from `research/nyoni/atelier-cloths.json` by `scripts/build-atelier-cloths.mjs`), `ClothWeight` |
| `materials.ts` | `BUTTON_SEED`, `LINING_SEED` (codes, names, hex, supplier refs), `MONOGRAM_RULES` (max 4 chars, A–Z and `.`, placements, threads, fonts) |
| `looks.ts` | `LOOKS: Look[]` — recommended looks per occasion (`key`, `name`, `occasion[]`, `spec: SuitSpec`, `clothCode`, `why`) |
| `measurements.ts` | `MEASUREMENT_FIELDS` (key, label, group, guide text, plausible range in cm), `UNITS`, `toCm`, `fromCm`, `roundMeasurement` (0.5 cm / 0.25 in), `COMFORT_OPTIONS`, `MOVEMENT_OPTIONS` |
| `policy.ts` | Verified house facts as copy: lead time ("about six weeks from your first fitting"), fittings included, alterations promise, final-sale rule, refund policy summary, photo retention (`PHOTO_RETENTION_DAYS = 30`), `CONSENT_VERSION`, `PROVIDER_DISCLOSURE`, deadline buffer rules (`EVENT_BUFFER_DAYS`) |
| `validators.ts` | `v*` validators for everything above (`vSuitSpec`, `vStaffRole`, `vOccasion`, `vCaseStatus`, …) built with `literals()` from `convex/shared/validators.ts` |

### The spec

```ts
type SuitSpec = {
  garment: "two_piece" | "three_piece" | "tuxedo";
  clothCode: string | null;
  jacket: {
    breast: "single" | "double";
    buttons: "one" | "two" | "three" | "four_by_two" | "six_by_two";
    lapel: "notch" | "peak" | "shawl";
    lapelWidth: "slim" | "standard" | "wide";
    vents: "none" | "single" | "double";
    pockets: "flap" | "jetted" | "patch";
    ticketPocket: boolean;
    canvas: "half" | "full";
    shoulder: "natural" | "roped";
    sleeveButtons: "four" | "five";
    workingCuffs: boolean;
  };
  trousers: {
    fit: "classic" | "tailored" | "slim";
    pleats: "flat" | "single" | "double";
    rise: "mid" | "high";
    hem: "plain" | "cuffed";
    waistband: "belt_loops" | "side_adjusters";
  };
  waistcoat: { style: "single_five" | "single_six" | "double"; lapel: "none" | "shawl"; back: "cloth" | "lining" } | null;
  buttonCode: string | null;
  liningCode: string | null;
  monogram: { text: string; placement: "inside_pocket" | "inside_chest" | "cuff"; thread: "gold" | "ivory" | "navy" | "tonal"; font: "script" | "block" } | null;
};
```

Compatibility rules (the dependency engine, S08). `applyChange` returns conflicts and the proposed resolution; the caller confirms to apply everything atomically, or cancels to keep the original spec unchanged:

1. `breast: "double"` requires `lapel: "peak"` (or `shawl` on a tuxedo) and `buttons ∈ {four_by_two, six_by_two}`; `breast: "single"` requires `buttons ∈ {one, two, three}`.
2. `lapel: "shawl"` requires `garment: "tuxedo"` or (`breast: "single"` and `buttons: "one"`).
3. `garment: "tuxedo"` requires `pockets: "jetted"`, `ticketPocket: false`, `vents ∈ {none, double}`; `patch` pockets are never offered on a tuxedo.
4. `waistcoat` is non-null iff `garment: "three_piece"`; on `two_piece`/`tuxedo` it is set to `null` (a conflict names it).
5. `trousers.hem: "cuffed"` is not offered with `garment: "tuxedo"`.
6. `monogram.text` matches `MONOGRAM_RULES`; invalid text is a field error, not a conflict.
7. A `clothCode` whose entry is `withdrawn` or `inStock: false` is a *warning* the review step must surface and the client must re-confirm (C03, C19); it is never silently replaced.

Every option has a `productionId` (e.g. `LAPEL_PEAK`, `VENT_DOUBLE`, `TROUSER_PLEAT_SINGLE`); `describeSpec` lists them for the review, export and staff views so they match (C06, C19 acceptance).

---

## 4. Schema (added to `convex/schema.ts` by the lead)

All table names are prefixed `atelier`. Ownership fields are `userId?: Id<"users">` and `guestKey?: string` with indexes `by_user` and `by_guestKey` where clients read their own rows.

| Table | Purpose | Key fields and indexes |
| --- | --- | --- |
| `atelierCatalogueVersions` | published catalogue versions (O02) | `version`, `publishedAt`, `publishedBy?`, `note` · `by_version` |
| `atelierCatalogueEntries` | cloths, buttons, linings | `kind`, `code`, `name`, `mill?`, `supplierRef?`, `productUrl?`, `productId?`, `description`, `composition?`, `weight?`, `pattern`, `colour`, `hex`, `shadeConfirmed`, `season[]`, `occasions[]`, `priceUsd?`, `inStock`, `sampleAvailable`, `image?` (local path), `swatchStorageId?`, `status` (draft/approved/withdrawn), `version`, `provenance`, `approvedBy?`, `approvedAt?`, `sortOrder`, `createdAt`, `updatedAt` · `by_kind_status`, `by_kind_code` |
| `atelierDrafts` | the working design | `userId?`, `guestKey?`, `name`, `occasion?`, `eventDate?`, `intendedUse?`, `spec`, `shortlist[]` (≤3 cloth codes), `fitRoute?`, `fitProfileId?`, `stage`, `completedSteps[]`, `catalogueVersion`, `revision`, `status`, `lookKey?`, `personPhotoId?`, `currentPreviewJobId?`, `sourceOrderId?`, `groupId?`, `createdAt`, `updatedAt`, `lastSavedAt` · `by_user`, `by_guestKey`, `by_group` |
| `atelierRevisions` | immutable snapshots | `draftId`, `revision`, `spec`, `specHash`, `occasion?`, `eventDate?`, `catalogueVersion`, `reason` (submitted/proposal_accepted/preview/quote/reorder), `createdAt` · `by_draft_revision` |
| `atelierShares` | read-only links | `draftId`, `token`, `userId?`, `guestKey?`, `audience`, `expiresAt`, `revokedAt?`, `createdAt` · `by_token`, `by_draft` |
| `atelierPersonPhotos` | consented full-body photos | owner fields, `storageId`, `mimeType`, `width`, `height`, `consentVersion`, `consentAt`, `providerDisclosureVersion`, `status` (active/pending_deletion/deleted), `expiresAt`, `deletedAt?`, `validation { ok, reasons[] }`, `createdAt` · `by_user`, `by_guestKey`, `by_status_expiresAt` |
| `atelierPreviewJobs` | personal preview lifecycle | owner fields, `draftId`, `personPhotoId`, `revisionId`, `specHash`, `specLabel`, `idempotencyKey`, `status` (queued/processing/done/failed/cancelled/expired), `resultStorageId?`, `quality` (pending/accepted/rejected), `qualityNote?`, `error?`, `attempt`, `startedAt?`, `completedAt?`, `cancelledAt?`, `expiresAt?`, `usage?`, `costUsd?`, `createdAt` · `by_draft`, `by_user`, `by_guestKey`, `by_idempotencyKey`, `by_status` |
| `atelierFitProfiles` | measurement profiles (accounts only) | `userId`, `version`, `units`, `measurements` (record), `comfort { jacket, trousers, movement[] }`, `posture?`, `provenance` (atelier/remote_guided/imported), `notes?`, `uncertainFields[]`, `status` (provisional/needs_clarification/approved/superseded), `clarification?`, `reviewerId?`, `reviewedAt?`, `reviewNote?`, `approvedValues?`, `supersedesId?`, `createdAt`, `updatedAt` · `by_user_version`, `by_status` |
| `atelierFitPhotos` | consented posture photos | `userId`, `profileId`, `storageId`, `pose`, `consentAt`, `status`, `createdAt` · `by_profile` |
| `atelierCases` | every service request | `kind`, owner fields, `draftId?`, `revisionId?`, `orderId?`, `correctionId?`, `appointmentId?`, `groupId?`, `contact { name, email, phone?, preferredShowroom?, channel }`, `message?`, `sample? { clothCode, address{line1,line2?,city,region,postalCode,country} }`, `submissionKey`, `status`, `ownerStaffId?`, `assignedAt?`, `nextAction?`, `nextActionDueAt?`, `priority`, `escalatedAt?`, `lastActivityAt`, `closedAt?`, `createdAt` · `by_user`, `by_guestKey`, `by_status_lastActivity`, `by_owner_status`, `by_submissionKey`, `by_draft`, `by_order` |
| `atelierCaseMessages` | the conversation | `caseId`, `author` (client/staff/system), `authorUserId?`, `body`, `proposalId?`, `createdAt` · `by_case` |
| `atelierProposals` | staff-proposed spec changes (C20) | `caseId`, `draftId`, `baseRevision`, `beforeSpec`, `afterSpec`, `rationale`, `commercialImpact` (none/new_quote), `status` (proposed/accepted/rejected/withdrawn), `decidedAt?`, `createdByStaffId`, `createdAt` · `by_case` |
| `atelierAppointments` | fittings | owner fields, `caseId?`, `draftId?`, `service`, `showroomId` (ShowroomId or "virtual"), `preferredWindows[] { date, period }`, `notes?`, `accessibility?`, `timeZone`, `status`, `confirmedStart?`, `confirmedEnd?`, `calendarRef?`, `history[] { at, from, to, by, note? }`, `eventDate?`, `createdAt`, `updatedAt` · `by_user`, `by_guestKey`, `by_status`, `by_case` |
| `atelierQuotes` | priced offers | `caseId`, `draftId`, `revisionId`, `version`, `lines[] { code, label, amountUsd, kind }`, `subtotalUsd`, `totalUsd`, `benefit? { tier, redemptionId, description }`, `leadTimeWeeks?`, `fittingsIncluded?`, `terms`, `expiresAt`, `status`, `offeredAt?`, `acceptedAt?`, `acceptedSpecHash?`, `supersedesId?`, `createdByStaffId`, `createdAt` · `by_case_version`, `by_status` |
| `atelierBenefitRedemptions` | the annual suit (C14) | `userId`, `membershipYearKey`, `tier`, `status` (reserved/redeemed/released), `quoteId?`, `orderId?`, `reservedAt`, `redeemedAt?`, `releasedAt?`, `note?` · `by_user_year`, `by_quote` |
| `atelierOrders` | released commissions | owner fields, `caseId`, `quoteId`, `revisionId`, `draftId`, `fitProfileId?`, `spec`, `specHash`, `status`, `payment { state, amountUsd?, reference?, confirmedAt?, provider? }`, `eventDate?`, `estimatedReadyAt?`, `releasedAt?`, `releasedByStaffId?`, `makerRef?`, `shippedAt?`, `carrier?`, `trackingRef?`, `deliveredAt?`, `fitAcceptedAt?`, `firstFitChecklist?` (record of region → ok/issue/unchecked), `riskNote?`, `createdAt`, `updatedAt` · `by_user`, `by_guestKey`, `by_status`, `by_case` |
| `atelierOrderMilestones` | dated, sourced milestones | `orderId`, `kind`, `label`, `at`, `source` (staff/maker/carrier/client/system), `byUserId?`, `note?`, `estimated` · `by_order` |
| `atelierCorrections` | alterations, remakes, returns, refunds, cancellations | `orderId`, owner fields, `caseId`, `kind`, `region?`, `description`, `photoStorageIds[]`, `status`, `remedy? { kind, coverage, amountUsd?, logistics, deadline?, approvedByStaffId }`, `refund? { state, amountUsd?, confirmedAt?, reference? }`, `reassessment? { at, outcome, note }`, `fitProfileVersionBefore?`, `fitProfileVersionAfter?`, `escalatedAt?`, `createdAt`, `updatedAt` · `by_order`, `by_user`, `by_guestKey`, `by_status`, `by_case` |
| `atelierPrivacyRequests` | export / deletion / closure | owner fields, `kind`, `status`, `steps[] { key, label, status, at?, note? }`, `exceptions[]`, `exportStorageId?`, `requestedAt`, `completedAt?`, `handledByStaffId?` · `by_user`, `by_guestKey`, `by_status` |
| `atelierGroups` | wedding / group briefs | `organizerUserId`, `name`, `eventDate?`, `occasion`, `brief`, `sharedSpec` (SuitSpec), `permittedIndividual[]`, `status`, `staffReviewNote?`, `createdAt`, `updatedAt` · `by_organizer` |
| `atelierGroupParticipants` | invited members | `groupId`, `inviteToken`, `name`, `email?`, `userId?`, `draftId?`, `status`, `consent { shareStyleStatus, shareFitStatus }`, `joinedAt?`, `createdAt` · `by_group`, `by_inviteToken`, `by_user` |
| `atelierNotifications` | message records | owner fields, `caseId?`, `channel`, `to`, `subject`, `body`, `status` (queued/sent/delivered/failed), `providerRef?`, `error?`, `createdAt`, `sentAt?` · `by_case`, `by_status` |
| `atelierAuditLog` | who did what | `actorUserId?`, `actorKind`, `action`, `targetTable`, `targetId`, `meta?`, `at` · `by_target`, `by_actor`, `by_at` |

`users` gains `staffRoles?: v.array(vStaffRole)`.

---

## 5. Convex modules

Layout: thin public/internal functions in `convex/atelier/<domain>.ts`; business logic in `convex/model/atelier/<domain>.ts`; cross-domain return-shape validators in `convex/atelier/views.ts` (lead-owned), every other `v<Thing>View` exported from its own domain module. Lead-owned cores every domain builds on: `convex/model/atelier/catalogue.ts` (`ensureCatalogueSeeded`, `currentCatalogueVersion`, `getEntry`, `listApproved`, `toEntryView`, `clothSummary`, `specNames`), `convex/model/atelier/revisions.ts` (`createRevision`, `latestRevision`, `toRevisionSummary`), `convex/model/atelier/case_core.ts` (`createCase`, `appendMessage`, `touchCase`, `requireCase`, `findBySubmissionKey`) and `convex/model/atelier/notifications.ts` (`queueNotification`). Every function has `args` and `returns`. Every client-facing read goes through `resolveActor` / `requireDraftAccess`; every staff function through `requireStaff`.

Client reads take `guestKey: v.optional(v.string())` so guests can read what they own; the frontend passes it from `useAtelierSession()`.

### 5.1 `catalogue` (owner: catalogue agent)

- `list({ kind })` → approved entries for clients (cloths include `shadeConfirmed`, `inStock`, `sampleAvailable`).
- `get({ kind, code })` → entry or null (withdrawn entries are returned with `status` so a draft can still name them).
- `currentVersion()` → number.
- Staff: `listAll({ kind? })`, `upsert(entry)`, `setStatus({ id, status })`, `confirmShade({ id, hex })`, `setStock({ id, inStock, sampleAvailable })`, `publishVersion({ note })` (bumps version, stamps entries, writes audit).
- Internal: `seed()` idempotent from `CLOTH_SEED`, `BUTTON_SEED`, `LINING_SEED` (status `approved`, `shadeConfirmed: false`, provenance "WooCommerce export 2026-09-21"); `ensureSeeded()` called by `drafts.create` when the table is empty so a fresh deployment works.

### 5.2 `drafts` (owner: drafts agent)

- `create({ guestKey?, lookKey?, occasion? })` → `draftId`. Guests must pass a guestKey.
- `get({ draftId, guestKey? })` → `DraftView` (spec, shortlist, stage, completedSteps, revision, status, catalogueVersion, lookKey, cloth entry summary, warnings from `revalidate`, `hasPhoto`, `currentPreview` summary, fitRoute, fitProfile summary, `savedAt`) or null.
- `listMine({ guestKey? })` → `DraftSummary[]` newest first.
- `commit({ draftId, guestKey?, patch, acceptedConflicts: boolean })` → `{ revision, conflicts }`. Runs `applyChange`; if conflicts exist and `acceptedConflicts` is false, returns them without writing (S08). Marks the current preview stale by comparing `specHash`.
- `setOccasion`, `setShortlist`, `setStage({ step })`, `setFitRoute`, `rename`, `archive`, `applyLook({ lookKey })`, `duplicate({ draftId })` (reorder source), `link({ draftId, guestKey })` (signed-in; moves ownership), `exportJson` (query returning the spec + descriptions for download/print).
- `revalidate` is a model helper that compares `catalogueVersion` and cloth status and returns warnings; `get` includes them.

### 5.3 `shares` (owner: drafts agent)

- `create({ draftId, guestKey?, audience, expiresInDays })` → `{ token, url }`; `revoke({ shareId })`; `listForDraft`; `getByToken({ token })` → `SharedDesignView | { expired: true } | null`.

### 5.4 `photos` and `previews` (owner: previews agent)

- `photos.generateUploadUrl({ guestKey? })`, `photos.register({ guestKey?, storageId, mimeType, width, height, consentVersion })` (validates type/size/dimensions, sets `expiresAt = now + PHOTO_RETENTION_DAYS`), `photos.get({ guestKey? })` (the active photo with a signed URL, never the storage id), `photos.remove({ photoId, guestKey? })` (cancels active jobs, revokes results, sets pending_deletion → deleted), `photos.replace`.
- `previews.start({ draftId, guestKey? })` → `{ jobId, reused }`. Idempotent on `specHash + personPhotoId`; freezes a revision (`reason: "preview"`); enforces `ATELIER_LIMITS.previewsPerDay`; throws `PREVIEWS_UNAVAILABLE` when no key is configured (new error code).
- `previews.cancel`, `previews.listForDraft` (each with `isCurrent = specHash === draft specHash`), `previews.get`, `previews.retry`.
- Internal: `beginJob`, `completeJob`, `failJob`, `expireJobs` (cron), plus `convex/atelier/generation.ts` (`"use node"`) `generatePersonalPreview` action following `convex/ai/openai.ts` conventions, prompt built from `describeSpec`. Results are stored privately; reads are owner-authorized and staff reads audited.

### 5.5 `fit` (owner: fit agent)

- `myProfile()` → current profile view or null; `listMyProfiles()`; `submitRemote({ units, measurements, comfort, uncertainFields, notes })` → provisional profile (new version, supersedes none until approved); `startRevision({ fromProfileId })`; `confirmReuse({ profileId, draftId })`; `attachPhotoUrl`, `registerFitPhoto`.
- Staff (`fitter`): `queue()`, `approve({ profileId, approvedValues, reviewNote })`, `requestClarification({ profileId, clarification })`.
- Approving supersedes the previous approved version; an approved profile is never edited in place.

### 5.6 `cases` (owner: cases agent)

- `submit({ kind, guestKey?, draftId?, contact, message?, sample?, submissionKey })` → `{ caseId, revisionId?, duplicate }`. Idempotent on `submissionKey`. For `design_review`/`quote` it freezes a revision (`reason: "submitted"`) and sets the draft `status: "submitted"`. Queues a notification record.
- `get({ caseId, guestKey? })` → `CaseView` (status, owner first name only, nextAction, revision summary, latest message, quote summary, appointment summary); `listMine`; `messages.list`, `messages.send`; `respondToProposal({ proposalId, accept })` (accept writes a new revision `reason: "proposal_accepted"` and, if `commercialImpact: "new_quote"`, supersedes the offered quote).
- Staff (`concierge`): `queue({ filter })`, `assign({ caseId, staffId })`, `transfer`, `setNextAction`, `setStatus`, `propose({ caseId, afterSpec, rationale, commercialImpact })`, `withdrawProposal`, `markSample({ caseId, state })`.
- Internal cron `escalateOverdue` marks unassigned cases older than `ATELIER_LIMITS.assignWithinHours` or `nextActionDueAt` passed as `priority: "high"` with `escalatedAt`.

### 5.7 `appointments` (owner: cases agent)

- `request({ guestKey?, draftId?, caseId?, service, showroomId, preferredWindows, notes?, accessibility?, timeZone, eventDate?, contact? })` → `appointmentId` (also creates/links a `fitting` case); `get`, `listMine`, `reschedule({ preferredWindows })` (status back to requested with history), `cancel`.
- Staff: `confirm({ appointmentId, confirmedStart, confirmedEnd, calendarRef })` (status `confirmed` requires all three), `complete`, `listPending`.

### 5.8 `quotes` and `benefits` (owner: commerce agent)

- `quotes.listForCase`, `quotes.get`, `quotes.accept({ quoteId, guestKey? })` (requires status `offered`, not expired, and `acceptedSpecHash` must equal the current submitted revision hash; redeems a reserved benefit; creates the order in `status: "preflight"`).
- Staff (`finance`): `quotes.create({ caseId, lines, leadTimeWeeks, fittingsIncluded, terms, expiresAt, benefit? })` (draft), `quotes.offer`, `quotes.supersede`, `quotes.withdraw`.
- `benefits.myEligibility()` → `{ tier, status, included: boolean, yearKey, redemption | null, reason }` from `users.membership` only; `benefits.reserve({ quoteId })` and `release` are staff/internal; browsing never reserves.

### 5.9 `orders` (owner: commerce agent)

- `get({ orderId, guestKey? })` → `OrderView` (status, payment state words, milestones, estimate labelled, spec description, fit profile version, checklist, corrections summary); `listMine`; `setFirstFitChecklist`; `acceptFit`. Flagging a fit issue is `corrections.request` (§5.10), which also moves the order to `correction_open`.
- Staff (`operations`): `preflight({ orderId })` (checks quote accepted, revision hash matches, fit profile approved or route recorded, payment state as policy requires) → list of blockers; `release({ orderId, makerRef })` (fails on blockers); `addMilestone`; `markShipped`; `markDelivered`; `recordPayment({ orderId, state, amountUsd, reference, provider })` (idempotent on reference); `setRisk`.

### 5.10 `corrections` (owner: aftercare agent)

- `request({ orderId, guestKey?, kind, region?, description, photoStorageIds? })` → `{ correctionId, caseId }` (creates the aftercare case through `createCase`, records `fitProfileVersionBefore`, sets the order `status: "correction_open"`); `get`, `listForOrder`, `acceptRemedy`, `reassess({ outcome, note })`.
- Staff (`operations`/`finance`): `triage`, `proposeRemedy`, `setStatus`, `confirmRefund({ correctionId, amountUsd, reference })` (the only way `refund.state` becomes `refunded`), `escalate`.

### 5.11 `privacy` (owner: aftercare agent)

- `request({ kind, guestKey? })` → `requestId`; `get`, `listMine`. Internal `advance` runs steps: revoke shares, cancel preview jobs, delete photos and results, export JSON to storage, record exceptions (active orders keep spec + fit profile). Staff (`privacy`): `queue`, `advance`, `complete`, `listAudit`.

### 5.12 `groups` (owner: groups agent)

- Organizer: `create`, `update`, `invite({ groupId, name, email? })` → invite token, `get`, `listMine`, `removeParticipant`.
- Participant: `getInvite({ token })`, `join({ token, guestKey? })` (creates a draft from `sharedSpec`), `setConsent`, `leave`.
- Staff: `review({ groupId, note, status })`. Organizer views see consented status only, never measurements or photos.

### 5.13 `staff` and `notifications` (owner: staff agent)

- `staff.me()` → `{ roles, isAdmin }`; `staff.list()`; `staff.setRoles({ userId, roles })` (admin only, audited); `staff.auditLog({ targetTable?, targetId?, limit })`.
- `notifications.queue` (internal helper used by cases/appointments/quotes), `notifications.listForCase` (staff).
- `convex/crons.ts`: hourly `previews.expireJobs`, `photos.expire`, `cases.escalateOverdue`, `quotes.expire`.

### Errors

New codes appended to `ERROR_CODES` in `convex/lib/errors.ts`: `PREVIEWS_UNAVAILABLE`, `STALE_REVISION`, `QUOTE_EXPIRED`, `NOT_ELIGIBLE`, `RELEASE_BLOCKED`, `INVALID_STATE`.

---

## 6. Frontend

### Shell and session

- `src/app/(atelier)/layout.tsx` renders `<AtelierShell>` (`src/components/atelier/shell/atelier-shell.tsx`): wordmark with the "Atelier" caption, quiet top navigation (Design · Drafts · Requests · Orders · Fit · Privacy), sign-in / account control, theme toggle. No onboarding gate. Mobile: a bottom bar of the same destinations.
- `src/components/atelier/shell/atelier-session.tsx`: `AtelierSessionProvider` + `useAtelierSession()` → `{ guestKey, storageAvailable, draftIndex, rememberDraft, forgetDraft }`. Mints the guest key, keeps the local draft index (`nyoni.atelier.drafts`), falls back to memory when storage is blocked and exposes `storageAvailable: false` so screens can say so (C01, C12).
- Hooks in `src/hooks/atelier/`: `use-draft.ts` (`useDraft(draftId)`), `use-catalogue.ts`, `use-spec-editor.ts` (local pending change + `applyChange` preview + conflict dialog state + commit), `use-save-status.ts` (`saving` / `saved` / `pending` / `offline` with the actual scope word: "Saved to this browser" vs "Saved to your account"), `use-my-cases.ts`, `use-my-orders.ts`.

### The studio (`src/components/atelier/studio/`)

- `studio-frame.tsx`: two columns on desktop (stage left, 7/12; panel right, 5/12), stacked on phones with the stage as a sticky 40vh header that collapses while the panel scrolls; the primary action is never under a fixed footer (S&S contract).
- `stage.tsx`: shows `SuitFigure` (studio illustration) or the current personal preview with an `Original / Studio / Personal` control; `Studio illustration` / `Illustrative preview` captions; stale banner "Shows a previous design"; swatch closeup toggle.
- `suit-figure.tsx`: parametric SVG. Props: `spec`, `hex`, `pattern`, `view: "front" | "back"`. Draws jacket (breast, buttons, lapel, pockets, ticket pocket, vents on back), trousers (pleats, cuffs), waistcoat when present, shirt and shoes in neutral ink. Hairline strokes in `currentColor`, cloth fill from `hex` with a subtle pattern overlay for stripes/checks/herringbone. Works in both themes.
- `step-rail.tsx`: the seven steps with done/current/pending marks and real completion state from `completedSteps`.
- `save-status.tsx`: the truthful save indicator.
- Step panels: `occasion-panel.tsx`, `cloth/` (browser with filters + result count + Clear all, inspection sheet with book photo + representative shade + sample request, shortlist tray + compare), `style/` (base style, focused detail panel with Apply/Cancel, conflict dialog), `details/` (buttons, lining, monogram with live validation and the honest "placement reviewed at fitting" note), `preview/` (consent intro, drop zone + validation + retake reasons, queue/processing/cancel, result with controls, comparison, photo controls), `fit/` (route choice, link to profile and fittings), `review/` (editable sections, warnings, pending confirmations, request form with contact + consent, print/export).

### Other client surfaces

`src/components/atelier/{entry,drafts,share,link,membership,fit,fittings,requests,orders,aftercare,privacy,groups}/` with one component per screen state; skeletons named `*-skeleton.tsx`; `EmptyState` for empty lists with the one next action.

### Staff surfaces

`src/components/atelier/staff/` — `case-queue.tsx`, `case-detail.tsx`, `quote-composer.tsx`, `catalogue-table.tsx`, `fit-review.tsx`, `production-board.tsx`, `preview-ops.tsx`, `aftercare-board.tsx`, `privacy-board.tsx`, `staff-roles.tsx`, `audit-log.tsx`. Dense, Operate mode, tables and forms from `src/components/ui`.

### State language (exact words, from the spec)

| Fact | Say | Never |
| --- | --- | --- |
| Draft saved in this browser only | "Saved to this browser" | "Saved" alone |
| Draft saved to account | "Saved to your account" | |
| Request submitted | "Request received" + receipt id | "Booked", "Ordered" |
| Appointment requested | "Requested · awaiting confirmation" | "Confirmed" |
| Appointment confirmed by staff with calendar ref | "Confirmed for {date}" | |
| Quote accepted, no payment confirmed | "Quote accepted · payment not yet recorded" | "Paid" |
| Payment recorded by staff | "Payment confirmed" | |
| Order shipped | "Shipped" (carrier) — fit review still open | "Delivered and fitted" |
| Refund approved, not confirmed | "Refund approved · not yet returned to you" | "Refunded" |
| Preview job | "Queued" / "Working on your preview" / "Could not finish" / "Cancelled" / "Shows a previous design" | percentages, countdowns |
| Deletion | "Access removed" / "Deleting" / "Waiting on provider" / "Completed with exceptions" | "Deleted instantly" |
| Estimated dates | "Estimate" label beside every estimated date | bare dates |
| Studio figure | "Studio illustration" | "Preview of your suit" |
| Personal preview | "Illustrative preview — not a fitting" | "How it will fit" |

### Design (also recorded in `DESIGN.md` → "Atelier")

The house's own world, verified from nyonicouture.com: onyx ground `#080808`, cream type `#F2ECDF`, gold `#CAA663` as the single accent (primary button, selection, membership), brown `#2F281A` secondary surfaces, hairlines `#262626`, 0–4px radii, no shadows. Bodoni Moda for the display line and cloth names; Manrope for UI; IBM Plex Mono (0.16em tracking) for production codes, measurements and receipts. The entry page is Persuade mode and may use the site's own gold-rule eyebrow once; the studio and every task screen are Operate mode: no eyebrows, no cards nested in cards, no icon tiles, no gradients, no metric tiles. Signature move: the stage — a calm hairline figure wearing the cloth, beside a panel that reads like a tailor's order book (ruled rows, codes in mono, one decision per section). One authored motion: the cloth crossfade on the stage (≤250 ms, exponential ease-out, respects reduced motion). Light theme is the same ink and gold on cream and must look intentional. 44px targets, visible focus, one H1 per screen, `aria-live` for save and job status.

---

## 7. Cross-cutting acceptance → where it is enforced

| # | Scenario | Enforcement |
| --- | --- | --- |
| 1 | Guest → cloth → reload → sign in: survives, link conflict explicit | local index + `drafts.link` + `/atelier/link` |
| 2 | Incompatible style, cancel substitution: unchanged | `applyChange` returns conflicts; `commit` writes nothing unless `acceptedConflicts` |
| 3 | Preview B requested, edit to C, B arrives: B never claims C | `atelierPreviewJobs.specHash` vs draft hash; `isCurrent` |
| 4 | Delete photo mid-job: late result inaccessible | `photos.remove` cancels jobs; `completeJob` refuses when photo deleted |
| 5 | Revoke share, request again: inaccessible; no private data was ever in it | `shares.getByToken` checks `revokedAt`/`expiresAt`; `SharedDesignView` shape |
| 6 | Change units twice: rounding rule, no new approved profile | `roundMeasurement`, client-side conversion of a provisional draft only |
| 7 | Catalogue availability revoked after quote | `revalidate` warnings; `quotes.accept` rejects when cloth withdrawn; released orders untouched |
| 8 | Double submit on poor connectivity | `submissionKey` idempotency |
| 9 | Slot disappears | request-first model: no slot is ever promised; staff confirm |
| 10 | Duplicate payment callbacks | `recordPayment` idempotent on `reference` |
| 11 | Fit problem after delivery | `OrderView.spec` and fit profile version shown on the correction |
| 12 | Failed label/refund | correction `escalate` + `ownerStaffId` on the case |
| 13 | Reorder discontinued cloth | `duplicate` keeps source; `revalidate` warns; replacement explicit |
| 14 | Narrow viewport, keyboard, screen reader | shell + studio layout rules above |
| 15 | Storage unavailable | `storageAvailable: false` copy and download |
| 16 | Photo service unavailable | `PREVIEWS_UNAVAILABLE` handled; studio and requests work without it |

---

## 8. Ownership for parallel work

| Agent | Owns (create/edit only these) |
| --- | --- |
| lead | `convex/schema.ts`, `convex/shared/atelier/*`, `convex/atelier/access.ts`, `convex/atelier/views.ts`, `convex/model/atelier/{catalogue,revisions,case_core,notifications}.ts`, `convex/crons.ts`, `convex/lib/errors.ts`, `src/lib/routes.ts`, nav, `(atelier)/layout.tsx`, `src/components/atelier/shell/*`, `src/lib/atelier/local-drafts.ts`, `DESIGN.md`, `docs/08-*` |
| catalogue | `convex/atelier/catalogue.ts` (functions over the lead's model), `convex/model/atelier/catalogue_staff.ts`, `tests/atelier-catalogue.test.mjs` |
| drafts | `convex/model/atelier/{drafts,shares}.ts`, `convex/atelier/{drafts,shares}.ts`, tests |
| previews | `convex/model/atelier/{photos,previews}.ts`, `convex/atelier/{photos,previews,generation}.ts`, tests |
| fit | `convex/model/atelier/fit.ts`, `convex/atelier/fit.ts`, tests |
| cases | `convex/model/atelier/{cases,appointments,notifications}.ts`, `convex/atelier/{cases,appointments,notifications}.ts`, tests |
| commerce | `convex/model/atelier/{quotes,benefits,orders}.ts`, `convex/atelier/{quotes,benefits,orders}.ts`, tests |
| aftercare | `convex/model/atelier/{corrections,privacy}.ts`, `convex/atelier/{corrections,privacy}.ts`, tests |
| groups + staff | `convex/model/atelier/{groups,staff}.ts`, `convex/atelier/{groups,staff}.ts`, tests |
| frontend agents | one folder each under `src/components/atelier/` plus their route files under `src/app/(atelier)/atelier/**` or `src/app/(app)/admin/atelier/**`, and their hooks under `src/hooks/atelier/` |

A change outside your files is a report line, not an edit. Shared helpers you wish existed go in your report.
