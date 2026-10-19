import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  vDetectedItem,
  vFeature,
  vItemAttributes,
  vItemStatus,
  vJobStatus,
  vJobStep,
  vJobType,
  vMembership,
  vOutfitSlots,
  vPlanId,
  vPrefs,
  vRenderQuality,
  vReservation,
  vSeason,
  vTokenUsage,
} from "./shared/validators";
import {
  vAppointmentHistoryEntry,
  vAppointmentService,
  vAppointmentStatus,
  vAuditActorKind,
  vCaseKind,
  vCasePriority,
  vCaseStatus,
  vCatalogueKind,
  vCatalogueStatus,
  vChecklistState,
  vClothPattern,
  vClothWeight,
  vCommercialImpact,
  vContact,
  vCorrectionKind,
  vCorrectionStatus,
  vDraftStatus,
  vFitComfort,
  vFitPhotoPose,
  vFitProfileStatus,
  vFitProvenance,
  vFitRegion,
  vFitRoute,
  vGroupStatus,
  vMessageAuthor,
  vMilestoneSource,
  vNotificationChannel,
  vNotificationStatus,
  vOccasion,
  vOrderStatus,
  vParticipantConsent,
  vParticipantStatus,
  vPayment,
  vPhotoStatus,
  vPhotoValidation,
  vPosture,
  vPreferredWindow,
  vPreviewQuality,
  vPreviewStatus,
  vPrivacyKind,
  vPrivacyStatus,
  vPrivacyStep,
  vProposalStatus,
  vQuoteBenefit,
  vQuoteLine,
  vQuoteStatus,
  vReassessment,
  vRedemptionStatus,
  vRefund,
  vRemedy,
  vRevisionReason,
  vSampleRequest,
  vStaffRole,
  vStudioStep,
  vSuitSpec,
  vUnit,
} from "./shared/atelier/validators";

export const EMBEDDING_DIMENSIONS = 1536;

/** Rows a client may own as a guest (bearer `guestKey`) or as an account (`userId`); see convex/atelier/access.ts. */
const ownerFields = {
  userId: v.optional(v.id("users")),
  guestKey: v.optional(v.string()),
};

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("admin")),
    /** Set by the house (staff console or a later WooCommerce sync); absent means client. */
    membership: v.optional(vMembership),
    /** Atelier staff roles; an admin holds every role implicitly. Set by admins in the staff console. */
    staffRoles: v.optional(v.array(vStaffRole)),
    plan: vPlanId,
    planPeriodEnd: v.optional(v.number()),
    billingCheckedAt: v.optional(v.number()),
    features: v.array(vFeature),
    planCredits: v.number(),
    packCredits: v.number(),
    dailySpend: v.object({ dayKey: v.string(), credits: v.number() }),
    defaultAvatarId: v.optional(v.id("avatars")),
    onboardedAt: v.optional(v.number()),
    prefs: vPrefs,
    createdAt: v.number(),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_createdAt", ["createdAt"]),

  avatars: defineTable({
    userId: v.id("users"),
    storageId: v.id("_storage"),
    label: v.string(),
    isDefault: v.boolean(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  uploads: defineTable({
    userId: v.id("users"),
    batchId: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    sizeBytes: v.number(),
    jobId: v.optional(v.id("jobs")),
    detectedCount: v.optional(v.number()),
    candidates: v.optional(v.array(vDetectedItem)),
    selectedIndices: v.optional(v.array(v.number())),
    selectionJobId: v.optional(v.id("jobs")),
    selectionConfirmedAt: v.optional(v.number()),
    status: v.union(
      v.literal("queued"),
      v.literal("detecting"),
      v.literal("awaiting_selection"),
      v.literal("extracting"),
      v.literal("done"),
      v.literal("failed"),
      v.literal("partial"),
    ),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_batch", ["batchId"]),

  items: defineTable({
    userId: v.id("users"),
    /** Set on pieces seeded from `shared/collection.ts`; absent on the member's own garments. */
    collectionKey: v.optional(v.string()),
    uploadId: v.optional(v.id("uploads")),
    storageId: v.optional(v.id("_storage")),
    thumbStorageId: v.optional(v.id("_storage")),
    sourceBbox: v.optional(v.array(v.number())),
    ...vItemAttributes.fields,
    notes: v.optional(v.string()),
    searchText: v.string(),
    status: vItemStatus,
    wearCount: v.number(),
    lastWornAt: v.optional(v.number()),
    duplicateOfId: v.optional(v.id("items")),
    /** Set while an extraction job is rewriting this item's cutout (re-extract); the item stays visible meanwhile. */
    pendingJobId: v.optional(v.id("jobs")),
    usage: v.optional(vTokenUsage),
    costUsd: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_status", ["userId", "status"])
    .index("by_user_category", ["userId", "category"])
    .index("by_user_collectionKey", ["userId", "collectionKey"])
    .index("by_upload", ["uploadId"])
    .index("by_createdAt", ["createdAt"])
    .searchIndex("search_text", { searchField: "searchText", filterFields: ["userId"] }),

  /** Embeddings live apart from items so wardrobe reads stay small (a 1536-float vector is ~12 KB per item). */
  itemEmbeddings: defineTable({
    itemId: v.id("items"),
    userId: v.id("users"),
    embedding: v.array(v.float64()),
  })
    .index("by_item", ["itemId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: EMBEDDING_DIMENSIONS,
      filterFields: ["userId"],
    }),

  outfits: defineTable({
    userId: v.id("users"),
    name: v.string(),
    slots: vOutfitSlots,
    occasion: v.optional(v.string()),
    brief: v.optional(v.string()),
    reasoning: v.optional(v.string()),
    source: v.union(v.literal("manual"), v.literal("agent")),
    threadId: v.optional(v.id("threads")),
    /** When the outfit was listed in /outfits: creation for manual outfits, "Save" for agent proposals. Unset = proposal only. */
    savedAt: v.optional(v.number()),
    wornOn: v.array(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_savedAt", ["userId", "savedAt"])
    .index("by_thread", ["threadId"]),

  renders: defineTable({
    userId: v.id("users"),
    outfitId: v.id("outfits"),
    avatarId: v.id("avatars"),
    jobId: v.id("jobs"),
    storageId: v.optional(v.id("_storage")),
    quality: vRenderQuality,
    status: v.union(v.literal("pending"), v.literal("done"), v.literal("failed")),
    prompt: v.string(),
    usage: v.optional(vTokenUsage),
    costUsd: v.optional(v.number()),
    creditsCharged: v.number(),
    shareToken: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_outfit", ["outfitId"])
    .index("by_job", ["jobId"])
    .index("by_shareToken", ["shareToken"])
    .index("by_createdAt", ["createdAt"]),

  jobs: defineTable({
    userId: v.id("users"),
    type: vJobType,
    status: vJobStatus,
    steps: v.array(vJobStep),
    progress: v.number(),
    reservation: vReservation,
    refunds: vReservation,
    workflowId: v.optional(v.string()),
    uploadId: v.optional(v.id("uploads")),
    /** Upload batch this ingest job belongs to; a whole batch counts as one running unit for LIMITS.maxRunningJobsPerUser. */
    batchId: v.optional(v.string()),
    outfitIds: v.optional(v.array(v.id("outfits"))),
    resultIds: v.array(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user_status", ["userId", "status"])
    .index("by_user", ["userId"])
    .index("by_workflowId", ["workflowId"])
    .index("by_status", ["status", "createdAt"]),

  creditLedger: defineTable({
    userId: v.id("users"),
    delta: v.number(),
    bucket: v.union(v.literal("plan"), v.literal("pack")),
    kind: v.union(
      v.literal("plan_grant"),
      v.literal("plan_reset"),
      v.literal("signup_bonus"),
      v.literal("topup"),
      v.literal("reserve"),
      v.literal("refund"),
      v.literal("admin"),
    ),
    jobId: v.optional(v.id("jobs")),
    ref: v.string(),
    note: v.optional(v.string()),
    balanceAfter: v.number(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_ref", ["ref"])
    .index("by_createdAt", ["createdAt"]),

  threads: defineTable({
    userId: v.id("users"),
    title: v.string(),
    eveSessionId: v.optional(v.string()),
    sessionVerifiedAt: v.optional(v.number()),
    streamIndex: v.optional(v.number()),
    lastMessageAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_eveSessionId", ["eveSessionId"]),

  proposals: defineTable({
    threadId: v.id("threads"),
    userId: v.id("users"),
    outfitId: v.id("outfits"),
    jobId: v.optional(v.id("jobs")),
    createdAt: v.number(),
  })
    .index("by_thread", ["threadId"])
    .index("by_user", ["userId"]),

  systemCounters: defineTable({
    dayKey: v.string(),
    key: v.union(v.literal("credits_reserved"), v.literal("users_total")),
    value: v.number(),
  }).index("by_day_key", ["dayKey", "key"]),

  usageCounters: defineTable({
    userId: v.id("users"),
    dayKey: v.string(),
    counter: v.union(v.literal("detect"), v.literal("stylist")),
    count: v.number(),
  }).index("by_user_day_counter", ["userId", "dayKey", "counter"]),

  /** Per-day aggregates for the admin dashboard, bumped in the same mutations that change the underlying rows. */
  dailyStats: defineTable({
    dayKey: v.string(),
    creditsSold: v.number(),
    creditsGranted: v.number(),
    creditsSpent: v.number(),
    creditsRefunded: v.number(),
    revenueUsd: v.number(),
    cogsUsd: v.number(),
    rendersDone: v.number(),
    itemsExtracted: v.number(),
    jobsFailed: v.number(),
    newUsers: v.number(),
  }).index("by_day", ["dayKey"]),

  /** Running average duration per step prefix ("detect", "extract", "render") for ETAs. */
  stepStats: defineTable({
    key: v.string(),
    count: v.number(),
    avgMs: v.number(),
  }).index("by_key", ["key"]),

  // ---------------------------------------------------------------------------------------------
  // The Atelier (docs/08-atelier-build-contract.md §4)
  // ---------------------------------------------------------------------------------------------

  atelierCatalogueVersions: defineTable({
    version: v.number(),
    publishedAt: v.number(),
    publishedBy: v.optional(v.id("users")),
    note: v.string(),
  }).index("by_version", ["version"]),

  atelierCatalogueEntries: defineTable({
    kind: vCatalogueKind,
    code: v.string(),
    name: v.string(),
    mill: v.optional(v.string()),
    supplierRef: v.optional(v.string()),
    productUrl: v.optional(v.string()),
    productId: v.optional(v.number()),
    description: v.string(),
    composition: v.optional(v.string()),
    weight: v.optional(vClothWeight),
    pattern: vClothPattern,
    colour: v.string(),
    hex: v.string(),
    /** False until a fitter has checked the representative shade against the cloth itself. */
    shadeConfirmed: v.boolean(),
    season: v.array(vSeason),
    occasions: v.array(vOccasion),
    priceUsd: v.optional(v.number()),
    inStock: v.boolean(),
    sampleAvailable: v.boolean(),
    /** Path under public/ (the mill-book photograph) or a full URL. */
    image: v.optional(v.string()),
    swatchStorageId: v.optional(v.id("_storage")),
    status: vCatalogueStatus,
    version: v.number(),
    provenance: v.string(),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    sortOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_kind_status", ["kind", "status", "sortOrder"])
    .index("by_kind_code", ["kind", "code"]),

  atelierDrafts: defineTable({
    ...ownerFields,
    name: v.string(),
    occasion: v.optional(vOccasion),
    eventDate: v.optional(v.number()),
    intendedUse: v.optional(v.string()),
    spec: vSuitSpec,
    shortlist: v.array(v.string()),
    fitRoute: v.optional(vFitRoute),
    fitProfileId: v.optional(v.id("atelierFitProfiles")),
    stage: vStudioStep,
    completedSteps: v.array(vStudioStep),
    catalogueVersion: v.number(),
    revision: v.number(),
    status: vDraftStatus,
    lookKey: v.optional(v.string()),
    personPhotoId: v.optional(v.id("atelierPersonPhotos")),
    currentPreviewJobId: v.optional(v.id("atelierPreviewJobs")),
    sourceOrderId: v.optional(v.id("atelierOrders")),
    groupId: v.optional(v.id("atelierGroups")),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastSavedAt: v.number(),
  })
    .index("by_user", ["userId", "updatedAt"])
    .index("by_guestKey", ["guestKey", "updatedAt"])
    .index("by_group", ["groupId"]),

  atelierRevisions: defineTable({
    draftId: v.id("atelierDrafts"),
    revision: v.number(),
    spec: vSuitSpec,
    specHash: v.string(),
    occasion: v.optional(vOccasion),
    eventDate: v.optional(v.number()),
    catalogueVersion: v.number(),
    reason: vRevisionReason,
    createdAt: v.number(),
  }).index("by_draft_revision", ["draftId", "revision"]),

  atelierShares: defineTable({
    draftId: v.id("atelierDrafts"),
    token: v.string(),
    ...ownerFields,
    audience: v.string(),
    expiresAt: v.number(),
    revokedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_draft", ["draftId"]),

  atelierPersonPhotos: defineTable({
    ...ownerFields,
    storageId: v.id("_storage"),
    mimeType: v.string(),
    width: v.number(),
    height: v.number(),
    consentVersion: v.string(),
    consentAt: v.number(),
    providerDisclosureVersion: v.string(),
    status: vPhotoStatus,
    expiresAt: v.number(),
    deletedAt: v.optional(v.number()),
    validation: vPhotoValidation,
    createdAt: v.number(),
  })
    .index("by_user", ["userId", "status"])
    .index("by_guestKey", ["guestKey", "status"])
    .index("by_status_expiresAt", ["status", "expiresAt"]),

  atelierPreviewJobs: defineTable({
    ...ownerFields,
    draftId: v.id("atelierDrafts"),
    personPhotoId: v.id("atelierPersonPhotos"),
    revisionId: v.id("atelierRevisions"),
    specHash: v.string(),
    specLabel: v.string(),
    idempotencyKey: v.string(),
    status: vPreviewStatus,
    resultStorageId: v.optional(v.id("_storage")),
    quality: vPreviewQuality,
    qualityNote: v.optional(v.string()),
    error: v.optional(v.string()),
    attempt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    usage: v.optional(vTokenUsage),
    costUsd: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_draft", ["draftId", "createdAt"])
    .index("by_user", ["userId", "createdAt"])
    .index("by_guestKey", ["guestKey", "createdAt"])
    .index("by_idempotencyKey", ["idempotencyKey"])
    .index("by_status", ["status", "createdAt"])
    .index("by_photo", ["personPhotoId", "createdAt"]),

  atelierFitProfiles: defineTable({
    userId: v.id("users"),
    version: v.number(),
    units: vUnit,
    /** Centimetres, keyed by MEASUREMENT_FIELDS[].key. */
    measurements: v.record(v.string(), v.number()),
    comfort: vFitComfort,
    posture: v.optional(vPosture),
    provenance: vFitProvenance,
    notes: v.optional(v.string()),
    uncertainFields: v.array(v.string()),
    status: vFitProfileStatus,
    clarification: v.optional(v.string()),
    reviewerId: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    reviewNote: v.optional(v.string()),
    approvedValues: v.optional(v.record(v.string(), v.number())),
    supersedesId: v.optional(v.id("atelierFitProfiles")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_version", ["userId", "version"])
    .index("by_status", ["status", "createdAt"]),

  atelierFitPhotos: defineTable({
    userId: v.id("users"),
    profileId: v.id("atelierFitProfiles"),
    storageId: v.id("_storage"),
    pose: vFitPhotoPose,
    consentAt: v.number(),
    status: vPhotoStatus,
    createdAt: v.number(),
  }).index("by_profile", ["profileId"]),

  atelierCases: defineTable({
    kind: vCaseKind,
    ...ownerFields,
    draftId: v.optional(v.id("atelierDrafts")),
    revisionId: v.optional(v.id("atelierRevisions")),
    orderId: v.optional(v.id("atelierOrders")),
    correctionId: v.optional(v.id("atelierCorrections")),
    appointmentId: v.optional(v.id("atelierAppointments")),
    groupId: v.optional(v.id("atelierGroups")),
    contact: vContact,
    message: v.optional(v.string()),
    sample: v.optional(vSampleRequest),
    submissionKey: v.string(),
    status: vCaseStatus,
    ownerStaffId: v.optional(v.id("users")),
    assignedAt: v.optional(v.number()),
    nextAction: v.optional(v.string()),
    nextActionDueAt: v.optional(v.number()),
    priority: vCasePriority,
    escalatedAt: v.optional(v.number()),
    lastActivityAt: v.number(),
    closedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId", "lastActivityAt"])
    .index("by_guestKey", ["guestKey", "lastActivityAt"])
    .index("by_status_lastActivity", ["status", "lastActivityAt"])
    .index("by_owner_status", ["ownerStaffId", "status"])
    .index("by_submissionKey", ["submissionKey"])
    .index("by_draft", ["draftId"])
    .index("by_order", ["orderId"]),

  atelierCaseMessages: defineTable({
    caseId: v.id("atelierCases"),
    author: vMessageAuthor,
    authorUserId: v.optional(v.id("users")),
    body: v.string(),
    proposalId: v.optional(v.id("atelierProposals")),
    createdAt: v.number(),
  }).index("by_case", ["caseId", "createdAt"]),

  atelierProposals: defineTable({
    caseId: v.id("atelierCases"),
    draftId: v.id("atelierDrafts"),
    baseRevision: v.number(),
    beforeSpec: vSuitSpec,
    afterSpec: vSuitSpec,
    rationale: v.string(),
    commercialImpact: vCommercialImpact,
    status: vProposalStatus,
    decidedAt: v.optional(v.number()),
    createdByStaffId: v.id("users"),
    createdAt: v.number(),
  }).index("by_case", ["caseId", "createdAt"]),

  atelierAppointments: defineTable({
    ...ownerFields,
    caseId: v.optional(v.id("atelierCases")),
    draftId: v.optional(v.id("atelierDrafts")),
    service: vAppointmentService,
    showroomId: v.union(v.literal("charlotte"), v.literal("atlanta"), v.literal("houston"), v.literal("virtual")),
    preferredWindows: v.array(vPreferredWindow),
    notes: v.optional(v.string()),
    accessibility: v.optional(v.string()),
    timeZone: v.string(),
    status: vAppointmentStatus,
    confirmedStart: v.optional(v.number()),
    confirmedEnd: v.optional(v.number()),
    calendarRef: v.optional(v.string()),
    history: v.array(vAppointmentHistoryEntry),
    eventDate: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId", "updatedAt"])
    .index("by_guestKey", ["guestKey", "updatedAt"])
    .index("by_status", ["status", "createdAt"])
    .index("by_case", ["caseId"]),

  atelierQuotes: defineTable({
    caseId: v.id("atelierCases"),
    draftId: v.id("atelierDrafts"),
    revisionId: v.id("atelierRevisions"),
    version: v.number(),
    lines: v.array(vQuoteLine),
    subtotalUsd: v.number(),
    totalUsd: v.number(),
    benefit: v.optional(vQuoteBenefit),
    leadTimeWeeks: v.optional(v.number()),
    fittingsIncluded: v.optional(v.number()),
    terms: v.string(),
    expiresAt: v.number(),
    status: vQuoteStatus,
    offeredAt: v.optional(v.number()),
    acceptedAt: v.optional(v.number()),
    acceptedSpecHash: v.optional(v.string()),
    supersedesId: v.optional(v.id("atelierQuotes")),
    createdByStaffId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_case_version", ["caseId", "version"])
    .index("by_status", ["status", "expiresAt"]),

  atelierBenefitRedemptions: defineTable({
    userId: v.id("users"),
    membershipYearKey: v.string(),
    tier: v.string(),
    status: vRedemptionStatus,
    quoteId: v.optional(v.id("atelierQuotes")),
    orderId: v.optional(v.id("atelierOrders")),
    reservedAt: v.number(),
    redeemedAt: v.optional(v.number()),
    releasedAt: v.optional(v.number()),
    note: v.optional(v.string()),
  })
    .index("by_user_year", ["userId", "membershipYearKey"])
    .index("by_quote", ["quoteId"]),

  atelierOrders: defineTable({
    ...ownerFields,
    caseId: v.id("atelierCases"),
    quoteId: v.id("atelierQuotes"),
    revisionId: v.id("atelierRevisions"),
    draftId: v.id("atelierDrafts"),
    fitProfileId: v.optional(v.id("atelierFitProfiles")),
    spec: vSuitSpec,
    specHash: v.string(),
    status: vOrderStatus,
    payment: vPayment,
    eventDate: v.optional(v.number()),
    estimatedReadyAt: v.optional(v.number()),
    releasedAt: v.optional(v.number()),
    releasedByStaffId: v.optional(v.id("users")),
    makerRef: v.optional(v.string()),
    shippedAt: v.optional(v.number()),
    carrier: v.optional(v.string()),
    trackingRef: v.optional(v.string()),
    deliveredAt: v.optional(v.number()),
    fitAcceptedAt: v.optional(v.number()),
    firstFitChecklist: v.optional(v.record(v.string(), vChecklistState)),
    riskNote: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId", "updatedAt"])
    .index("by_guestKey", ["guestKey", "updatedAt"])
    .index("by_status", ["status", "updatedAt"])
    .index("by_case", ["caseId"]),

  atelierOrderMilestones: defineTable({
    orderId: v.id("atelierOrders"),
    kind: v.string(),
    label: v.string(),
    at: v.number(),
    source: vMilestoneSource,
    byUserId: v.optional(v.id("users")),
    note: v.optional(v.string()),
    estimated: v.boolean(),
  }).index("by_order", ["orderId", "at"]),

  atelierCorrections: defineTable({
    orderId: v.id("atelierOrders"),
    ...ownerFields,
    caseId: v.id("atelierCases"),
    kind: vCorrectionKind,
    region: v.optional(vFitRegion),
    description: v.string(),
    photoStorageIds: v.array(v.id("_storage")),
    status: vCorrectionStatus,
    remedy: v.optional(vRemedy),
    refund: v.optional(vRefund),
    reassessment: v.optional(vReassessment),
    fitProfileVersionBefore: v.optional(v.number()),
    fitProfileVersionAfter: v.optional(v.number()),
    escalatedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_order", ["orderId", "createdAt"])
    .index("by_user", ["userId", "updatedAt"])
    .index("by_guestKey", ["guestKey", "updatedAt"])
    .index("by_status", ["status", "updatedAt"])
    .index("by_case", ["caseId"]),

  atelierPrivacyRequests: defineTable({
    ...ownerFields,
    kind: vPrivacyKind,
    status: vPrivacyStatus,
    steps: v.array(vPrivacyStep),
    exceptions: v.array(v.string()),
    exportStorageId: v.optional(v.id("_storage")),
    requestedAt: v.number(),
    completedAt: v.optional(v.number()),
    handledByStaffId: v.optional(v.id("users")),
  })
    .index("by_user", ["userId", "requestedAt"])
    .index("by_guestKey", ["guestKey", "requestedAt"])
    .index("by_status", ["status", "requestedAt"]),

  atelierGroups: defineTable({
    organizerUserId: v.id("users"),
    name: v.string(),
    eventDate: v.optional(v.number()),
    occasion: vOccasion,
    brief: v.string(),
    sharedSpec: vSuitSpec,
    /** Spec fields participants may set for themselves, as dot paths such as "jacket.vents". */
    permittedIndividual: v.array(v.string()),
    status: vGroupStatus,
    staffReviewNote: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organizer", ["organizerUserId", "updatedAt"])
    .index("by_status", ["status", "updatedAt"]),

  atelierGroupParticipants: defineTable({
    groupId: v.id("atelierGroups"),
    inviteToken: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    draftId: v.optional(v.id("atelierDrafts")),
    status: vParticipantStatus,
    consent: vParticipantConsent,
    joinedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_group", ["groupId", "createdAt"])
    .index("by_inviteToken", ["inviteToken"])
    .index("by_user", ["userId"]),

  atelierNotifications: defineTable({
    ...ownerFields,
    caseId: v.optional(v.id("atelierCases")),
    channel: vNotificationChannel,
    to: v.string(),
    subject: v.string(),
    body: v.string(),
    status: vNotificationStatus,
    providerRef: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    sentAt: v.optional(v.number()),
  })
    .index("by_case", ["caseId", "createdAt"])
    .index("by_status", ["status", "createdAt"]),

  atelierAuditLog: defineTable({
    actorUserId: v.optional(v.id("users")),
    actorKind: vAuditActorKind,
    action: v.string(),
    targetTable: v.string(),
    targetId: v.string(),
    meta: v.optional(v.record(v.string(), v.any())),
    at: v.number(),
  })
    .index("by_target", ["targetTable", "targetId", "at"])
    .index("by_table_at", ["targetTable", "at"])
    .index("by_actor", ["actorUserId", "at"])
    .index("by_at", ["at"]),
});
