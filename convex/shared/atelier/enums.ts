/**
 * Enumerations for the Atelier, the house's made-to-measure suit experience. Every status word the
 * client reads and every state a staff tool switches on lives here once; labels sit beside the values
 * so copy stays in the house's voice (docs/08-atelier-build-contract.md §6, "State language").
 */

export const STAFF_ROLES = ["concierge", "fitter", "finance", "operations", "preview_ops", "privacy"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  concierge: "Concierge",
  fitter: "Fitter",
  finance: "Finance",
  operations: "Operations",
  preview_ops: "Preview operations",
  privacy: "Privacy",
};

/** The collections the house sells against on nyonicouture.com, in its order. */
export const OCCASIONS = ["wedding", "business", "black_tie", "corporate", "casual_refinement"] as const;
export type Occasion = (typeof OCCASIONS)[number];
export const OCCASION_LABELS: Record<Occasion, string> = {
  wedding: "Wedding",
  business: "Business",
  black_tie: "Black tie",
  corporate: "Corporate",
  casual_refinement: "Casual refinement",
};
/** The house's own words for each collection (site copy, verified 18 October 2026). */
export const OCCASION_BLURBS: Record<Occasion, string> = {
  wedding:
    "Impeccably tailored for your most important day. Every detail crafted for confidence, comfort and timeless style.",
  business: "Sharp, versatile tailoring built for the boardroom and beyond, refined enough to command any room.",
  black_tie: "Formal evening wear with hand-finished detail: satin trims, refined lapels and a flawless silhouette.",
  corporate: "A considered wardrobe for the modern professional: cohesive, durable and effortlessly polished.",
  casual_refinement: "Relaxed sophistication in breathable cloths: unstructured tailoring for elevated everyday style.",
};

export const STUDIO_STEPS = ["occasion", "cloth", "style", "details", "preview", "fit", "review"] as const;
export type StudioStep = (typeof STUDIO_STEPS)[number];
export const STEP_LABELS: Record<StudioStep, string> = {
  occasion: "Occasion",
  cloth: "Cloth",
  style: "Style",
  details: "Details",
  preview: "See it on you",
  fit: "Fit",
  review: "Review",
};
export function isStudioStep(value: string): value is StudioStep {
  return (STUDIO_STEPS as readonly string[]).includes(value);
}

export const DRAFT_STATUSES = ["draft", "submitted", "archived"] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];
export const DRAFT_STATUS_LABELS: Record<DraftStatus, string> = {
  draft: "Draft",
  submitted: "Submitted to the house",
  archived: "Archived",
};

export const FIT_ROUTES = ["atelier", "remote", "undecided"] as const;
export type FitRoute = (typeof FIT_ROUTES)[number];
export const FIT_ROUTE_LABELS: Record<FitRoute, string> = {
  atelier: "Fitting at a showroom",
  remote: "Guided measurements from home",
  undecided: "Decide with your concierge",
};

export const REVISION_REASONS = ["submitted", "proposal_accepted", "preview", "quote", "reorder"] as const;
export type RevisionReason = (typeof REVISION_REASONS)[number];

export const CATALOGUE_KINDS = ["cloth", "button", "lining"] as const;
export type CatalogueKind = (typeof CATALOGUE_KINDS)[number];
export const CATALOGUE_STATUSES = ["draft", "approved", "withdrawn"] as const;
export type CatalogueStatus = (typeof CATALOGUE_STATUSES)[number];
export const CLOTH_WEIGHTS = ["lightweight", "four_season", "autumn_winter", "summer"] as const;
export type ClothWeight = (typeof CLOTH_WEIGHTS)[number];
export const CLOTH_WEIGHT_LABELS: Record<ClothWeight, string> = {
  lightweight: "Lightweight",
  four_season: "Four seasons",
  autumn_winter: "Autumn and winter",
  summer: "Summer",
};
export const CLOTH_PATTERNS = [
  "solid",
  "pinstripe",
  "chalk_stripe",
  "glen_check",
  "plaid",
  "herringbone",
  "jacquard",
  "birdseye",
] as const;
export type ClothPattern = (typeof CLOTH_PATTERNS)[number];
export const CLOTH_PATTERN_LABELS: Record<ClothPattern, string> = {
  solid: "Solid",
  pinstripe: "Pinstripe",
  chalk_stripe: "Chalk stripe",
  glen_check: "Glen check",
  plaid: "Plaid",
  herringbone: "Herringbone",
  jacquard: "Jacquard",
  birdseye: "Birdseye",
};

export const CASE_KINDS = [
  "design_review",
  "quote",
  "sample",
  "fitting",
  "support",
  "aftercare",
  "privacy",
  "group",
] as const;
export type CaseKind = (typeof CASE_KINDS)[number];
export const CASE_KIND_LABELS: Record<CaseKind, string> = {
  design_review: "Design review",
  quote: "Quote request",
  sample: "Cloth sample",
  fitting: "Fitting",
  support: "Question",
  aftercare: "Aftercare",
  privacy: "Privacy request",
  group: "Group commission",
};
export const CASE_STATUSES = [
  "received",
  "assigned",
  "awaiting_client",
  "awaiting_staff",
  "completed",
  "cancelled",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];
export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  received: "Received · awaiting a concierge",
  assigned: "With your concierge",
  awaiting_client: "Waiting on you",
  awaiting_staff: "With the house",
  completed: "Completed",
  cancelled: "Cancelled",
};
export const CASE_PRIORITIES = ["normal", "high"] as const;
export type CasePriority = (typeof CASE_PRIORITIES)[number];
export const CASE_PRIORITY_LABELS: Record<CasePriority, string> = {
  normal: "Normal",
  high: "High priority",
};
export const MESSAGE_AUTHORS = ["client", "staff", "system"] as const;
export type MessageAuthor = (typeof MESSAGE_AUTHORS)[number];
export const PROPOSAL_STATUSES = ["proposed", "accepted", "rejected", "withdrawn"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];
export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  proposed: "Proposed · awaiting your decision",
  accepted: "Accepted",
  rejected: "Declined",
  withdrawn: "Withdrawn by the house",
};
export const COMMERCIAL_IMPACTS = ["none", "new_quote"] as const;
export type CommercialImpact = (typeof COMMERCIAL_IMPACTS)[number];
export const CONTACT_CHANNELS = ["email", "sms", "either"] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];
export const CONTACT_CHANNEL_LABELS: Record<ContactChannel, string> = {
  email: "Email",
  sms: "Text message",
  either: "Email or text",
};
export const SAMPLE_STATES = ["requested", "accepted", "shipped", "declined"] as const;
export type SampleState = (typeof SAMPLE_STATES)[number];
export const SAMPLE_STATE_LABELS: Record<SampleState, string> = {
  requested: "Requested · awaiting the house",
  accepted: "Accepted · being prepared",
  shipped: "Shipped",
  declined: "Not available",
};

export const APPOINTMENT_SERVICES = [
  "consultation",
  "first_fitting",
  "final_fitting",
  "measurement",
  "virtual",
] as const;
export type AppointmentService = (typeof APPOINTMENT_SERVICES)[number];
/** The services the house will hold by video; everything else needs a showroom. */
export const VIRTUAL_SERVICES: readonly AppointmentService[] = ["virtual", "consultation"];
export const APPOINTMENT_SERVICE_LABELS: Record<AppointmentService, string> = {
  consultation: "Private consultation",
  first_fitting: "First fitting",
  final_fitting: "Final fitting",
  measurement: "Measurements",
  virtual: "Virtual appointment",
};
export const APPOINTMENT_STATUSES = [
  "requested",
  "awaiting_confirmation",
  "confirmed",
  "rescheduled",
  "cancelled",
  "completed",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  requested: "Requested · awaiting confirmation",
  awaiting_confirmation: "Awaiting confirmation",
  confirmed: "Confirmed",
  rescheduled: "Rescheduled · awaiting confirmation",
  cancelled: "Cancelled",
  completed: "Completed",
};
export const APPOINTMENT_PERIODS = ["morning", "afternoon", "evening"] as const;
export type AppointmentPeriod = (typeof APPOINTMENT_PERIODS)[number];
export const APPOINTMENT_PERIOD_LABELS: Record<AppointmentPeriod, string> = {
  morning: "Morning (11am–1pm)",
  afternoon: "Afternoon (1pm–4pm)",
  evening: "Evening (4pm–7pm)",
};
export const APPOINTMENT_ACTORS = ["client", "staff", "system"] as const;
export type AppointmentActor = (typeof APPOINTMENT_ACTORS)[number];

export const QUOTE_STATUSES = ["draft", "offered", "accepted", "expired", "superseded", "withdrawn"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Being prepared",
  offered: "Offered · awaiting your approval",
  accepted: "Accepted",
  expired: "Expired",
  superseded: "Replaced by a newer quote",
  withdrawn: "Withdrawn",
};
export const QUOTE_LINE_KINDS = ["commission", "cloth", "option", "shipping", "tax", "benefit", "discount"] as const;
export type QuoteLineKind = (typeof QUOTE_LINE_KINDS)[number];
export const QUOTE_LINE_KIND_LABELS: Record<QuoteLineKind, string> = {
  commission: "Commission",
  cloth: "Cloth",
  option: "Option",
  shipping: "Delivery",
  tax: "Tax",
  benefit: "Membership benefit",
  discount: "Adjustment",
};
export const REDEMPTION_STATUSES = ["reserved", "redeemed", "released"] as const;
export type RedemptionStatus = (typeof REDEMPTION_STATUSES)[number];
export const REDEMPTION_STATUS_LABELS: Record<RedemptionStatus, string> = {
  reserved: "Reserved for a quote",
  redeemed: "Used for a commission",
  released: "Released",
};

export const ORDER_STATUSES = [
  "preflight",
  "released",
  "making",
  "quality_review",
  "shipped",
  "collected",
  "fit_review",
  "accepted",
  "correction_open",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  preflight: "Being checked before release",
  released: "Released to the cutter",
  making: "In the making",
  quality_review: "Quality review",
  shipped: "Shipped",
  collected: "Collected",
  fit_review: "Awaiting your fit review",
  accepted: "Fit accepted",
  correction_open: "A correction is open",
  cancelled: "Cancelled",
};
export const PAYMENT_STATES = ["none", "pending", "confirmed", "failed", "refunded_partial", "refunded"] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];
export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  none: "Payment not yet recorded",
  pending: "Payment pending",
  confirmed: "Payment confirmed",
  failed: "Payment did not go through",
  refunded_partial: "Partly refunded",
  refunded: "Refunded",
};
export const MILESTONE_SOURCES = ["staff", "maker", "carrier", "client", "system"] as const;
export type MilestoneSource = (typeof MILESTONE_SOURCES)[number];
export const MILESTONE_SOURCE_LABELS: Record<MilestoneSource, string> = {
  staff: "The house",
  maker: "The maker",
  carrier: "Carrier",
  client: "You",
  system: "Recorded by the system",
};

/** Milestone kinds the house records. The table keeps `kind` as a string so older rows still read. */
export const ORDER_MILESTONE_KINDS = [
  "quote_accepted",
  "payment",
  "released",
  "cloth_cut",
  "making",
  "quality_review",
  "shipped",
  "collected",
  "delivered",
  "fit_review",
  "fit_accepted",
  "correction_opened",
  "risk",
  "estimated_ready",
  "note",
] as const;
export type OrderMilestoneKind = (typeof ORDER_MILESTONE_KINDS)[number];
export const MILESTONE_KIND_LABELS: Record<OrderMilestoneKind, string> = {
  quote_accepted: "Quote accepted",
  payment: "Payment recorded",
  released: "Released to the cutter",
  cloth_cut: "Cloth cut",
  making: "In the making",
  quality_review: "Quality review",
  shipped: "Shipped",
  collected: "Collected",
  delivered: "Delivered",
  fit_review: "Fit review",
  fit_accepted: "Fit accepted",
  correction_opened: "Correction opened",
  risk: "Risk to the date",
  estimated_ready: "Estimated ready",
  note: "Note",
};
export const CHECKLIST_STATES = ["unchecked", "ok", "issue"] as const;
export type ChecklistState = (typeof CHECKLIST_STATES)[number];
/** The first-fit checklist regions, which are also the regions a correction can name. */
export const FIT_REGIONS = [
  "jacket_shoulders",
  "jacket_chest",
  "jacket_sleeves",
  "jacket_length",
  "jacket_collar",
  "trouser_waist",
  "trouser_seat",
  "trouser_length",
  "trouser_thigh",
  "detail_mismatch",
  "other",
] as const;
export type FitRegion = (typeof FIT_REGIONS)[number];
export const FIT_REGION_LABELS: Record<FitRegion, string> = {
  jacket_shoulders: "Jacket shoulders",
  jacket_chest: "Jacket chest and waist",
  jacket_sleeves: "Jacket sleeves",
  jacket_length: "Jacket length",
  jacket_collar: "Collar and neck",
  trouser_waist: "Trouser waist",
  trouser_seat: "Trouser seat",
  trouser_length: "Trouser length",
  trouser_thigh: "Trouser thigh and knee",
  detail_mismatch: "A detail does not match the design",
  other: "Something else",
};

export const CORRECTION_KINDS = ["alteration", "remake", "return", "exchange", "refund", "cancellation"] as const;
export type CorrectionKind = (typeof CORRECTION_KINDS)[number];
export const CORRECTION_KIND_LABELS: Record<CorrectionKind, string> = {
  alteration: "Alteration",
  remake: "Remake",
  return: "Return",
  exchange: "Exchange",
  refund: "Refund",
  cancellation: "Cancellation",
};
export const CORRECTION_STATUSES = [
  "requested",
  "triaged",
  "remedy_proposed",
  "accepted",
  "in_progress",
  "received",
  "completed",
  "escalated",
  "declined",
  "closed",
] as const;
export type CorrectionStatus = (typeof CORRECTION_STATUSES)[number];
export const CORRECTION_STATUS_LABELS: Record<CorrectionStatus, string> = {
  requested: "Requested",
  triaged: "Being reviewed",
  remedy_proposed: "A remedy is proposed",
  accepted: "Remedy accepted",
  in_progress: "In progress",
  received: "Garment received by the house",
  completed: "Completed · awaiting your reassessment",
  escalated: "Escalated to a senior member of the house",
  declined: "Declined",
  closed: "Closed",
};
export const REMEDY_COVERAGES = ["included", "member_included", "quoted", "store_credit"] as const;
export type RemedyCoverage = (typeof REMEDY_COVERAGES)[number];
export const REMEDY_COVERAGE_LABELS: Record<RemedyCoverage, string> = {
  included: "Included in your commission",
  member_included: "Included with your membership",
  quoted: "Quoted separately",
  store_credit: "Store credit",
};
export const REFUND_STATES = ["none", "approved", "processing", "refunded"] as const;
export type RefundState = (typeof REFUND_STATES)[number];
export const REFUND_STATE_LABELS: Record<RefundState, string> = {
  none: "No refund",
  approved: "Refund approved · not yet returned to you",
  processing: "Refund processing",
  refunded: "Refunded",
};
export const REASSESSMENT_OUTCOMES = ["resolved", "still_issue"] as const;
export type ReassessmentOutcome = (typeof REASSESSMENT_OUTCOMES)[number];

export const FIT_PROFILE_STATUSES = ["provisional", "needs_clarification", "approved", "superseded"] as const;
export type FitProfileStatus = (typeof FIT_PROFILE_STATUSES)[number];
export const FIT_PROFILE_STATUS_LABELS: Record<FitProfileStatus, string> = {
  provisional: "Submitted · awaiting review by a fitter",
  needs_clarification: "A fitter has a question",
  approved: "Approved by a fitter",
  superseded: "Superseded",
};
export const FIT_PROVENANCES = ["atelier", "remote_guided", "imported"] as const;
export type FitProvenance = (typeof FIT_PROVENANCES)[number];
export const FIT_PROVENANCE_LABELS: Record<FitProvenance, string> = {
  atelier: "Measured at a showroom",
  remote_guided: "Measured at home with the guide",
  imported: "Recorded by the house",
};
export const FIT_PHOTO_POSES = ["front", "side", "back"] as const;
export type FitPhotoPose = (typeof FIT_PHOTO_POSES)[number];

export const PREVIEW_STATUSES = ["queued", "processing", "done", "failed", "cancelled", "expired"] as const;
export type PreviewStatus = (typeof PREVIEW_STATUSES)[number];
export const PREVIEW_STATUS_LABELS: Record<PreviewStatus, string> = {
  queued: "Queued",
  processing: "Working on your preview",
  done: "Ready",
  failed: "Could not finish",
  cancelled: "Cancelled",
  expired: "Expired",
};
export const PREVIEW_QUALITIES = ["pending", "accepted", "rejected"] as const;
export type PreviewQuality = (typeof PREVIEW_QUALITIES)[number];
/** How the house judged a finished preview. "Set aside" is the client's word for a rejected result. */
export const PREVIEW_QUALITY_LABELS: Record<PreviewQuality, string> = {
  pending: "Not yet reviewed",
  accepted: "Accepted by the house",
  rejected: "Set aside by the house",
};
export const PHOTO_STATUSES = ["active", "pending_deletion", "deleted"] as const;
export type PhotoStatus = (typeof PHOTO_STATUSES)[number];
export const PHOTO_STATUS_LABELS: Record<PhotoStatus, string> = {
  active: "Kept for your previews",
  pending_deletion: "Being removed",
  deleted: "Removed",
};

export const PRIVACY_KINDS = ["export", "delete_photos", "delete_designs", "close_account"] as const;
export type PrivacyKind = (typeof PRIVACY_KINDS)[number];
export const PRIVACY_KIND_LABELS: Record<PrivacyKind, string> = {
  export: "Export my data",
  delete_photos: "Remove my photos and previews",
  delete_designs: "Delete my designs",
  close_account: "Close my account",
};
export const PRIVACY_STATUSES = [
  "requested",
  "access_revoked",
  "primary_deleted",
  "downstream_pending",
  "completed",
  "rejected",
] as const;
export type PrivacyStatus = (typeof PRIVACY_STATUSES)[number];
export const PRIVACY_STATUS_LABELS: Record<PrivacyStatus, string> = {
  requested: "Requested",
  access_revoked: "Access removed",
  primary_deleted: "Deleted from the house's systems",
  downstream_pending: "Waiting on a provider",
  completed: "Completed",
  rejected: "Could not be completed",
};
export const PRIVACY_STEP_STATUSES = ["pending", "done", "failed", "exception"] as const;
export type PrivacyStepStatus = (typeof PRIVACY_STEP_STATUSES)[number];
export const PRIVACY_STEP_STATUS_LABELS: Record<PrivacyStepStatus, string> = {
  pending: "Pending",
  done: "Done",
  failed: "Failed · can be re-run",
  exception: "Kept · a disclosed exception",
};

export const GROUP_STATUSES = ["draft", "inviting", "in_review", "approved", "closed"] as const;
export type GroupStatus = (typeof GROUP_STATUSES)[number];
export const GROUP_STATUS_LABELS: Record<GroupStatus, string> = {
  draft: "Being prepared",
  inviting: "Inviting participants",
  in_review: "With the house for review",
  approved: "Approved by the house",
  closed: "Closed",
};
export const PARTICIPANT_STATUSES = ["invited", "joined", "design_ready", "fit_ready", "ordered", "declined"] as const;
export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];
export const PARTICIPANT_STATUS_LABELS: Record<ParticipantStatus, string> = {
  invited: "Invited",
  joined: "Joined",
  design_ready: "Design ready",
  fit_ready: "Fit ready",
  ordered: "Ordered",
  declined: "Declined",
};

export const NOTIFICATION_CHANNELS = ["email", "sms", "in_app"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export const NOTIFICATION_STATUSES = ["queued", "sent", "delivered", "failed"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const AUDIT_ACTOR_KINDS = ["staff", "client", "system"] as const;
export type AuditActorKind = (typeof AUDIT_ACTOR_KINDS)[number];

/** Operational limits. Business-owned numbers are named so a decision changes one line. */
export const ATELIER_LIMITS = {
  shortlistMax: 3,
  /** Personal previews an owner may start per day; a budget, not a credit. */
  previewsPerDay: 6,
  /** A job still processing after this long is marked failed and may be retried. */
  previewTimeoutMinutes: 10,
  /** Result images are reachable for this long; the garment specification outlives them. */
  previewResultDays: 30,
  /** Unassigned cases older than this are escalated. */
  assignWithinHours: 24,
  quoteValidDays: 14,
  shareMaxDays: 30,
  draftsPerOwner: 20,
  maxPhotoBytes: 12 * 1024 * 1024,
  minPhotoEdgePx: 600,
  maxPhotoEdgePx: 6000,
  casesPerDay: 20,
  groupMaxParticipants: 12,
  /** Days before an event the house needs for a made-to-measure commission, per the site's "about six weeks". */
  eventBufferDays: 42,
  monogramMaxChars: 4,
  /** Free text a client writes on a case or an aftercare request. */
  caseTextMax: 2000,
  correctionTextMax: 2000,
  correctionPhotosMax: 6,
  /** Preferred windows a fitting request may name. */
  preferredWindowsMax: 3,
} as const;
