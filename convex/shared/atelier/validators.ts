import { v, type Infer } from "convex/values";
import { literals, vSeason } from "../validators";
import {
  APPOINTMENT_ACTORS,
  APPOINTMENT_PERIODS,
  APPOINTMENT_SERVICES,
  APPOINTMENT_STATUSES,
  AUDIT_ACTOR_KINDS,
  CASE_KINDS,
  CASE_PRIORITIES,
  CASE_STATUSES,
  CATALOGUE_KINDS,
  CATALOGUE_STATUSES,
  CHECKLIST_STATES,
  CLOTH_PATTERNS,
  CLOTH_WEIGHTS,
  COMMERCIAL_IMPACTS,
  CONTACT_CHANNELS,
  CORRECTION_KINDS,
  CORRECTION_STATUSES,
  DRAFT_STATUSES,
  FIT_PHOTO_POSES,
  FIT_PROFILE_STATUSES,
  FIT_PROVENANCES,
  FIT_REGIONS,
  FIT_ROUTES,
  GROUP_STATUSES,
  MESSAGE_AUTHORS,
  MILESTONE_SOURCES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUSES,
  OCCASIONS,
  ORDER_STATUSES,
  type OrderMilestoneKind,
  PARTICIPANT_STATUSES,
  PAYMENT_STATES,
  PHOTO_STATUSES,
  PREVIEW_QUALITIES,
  PREVIEW_STATUSES,
  PRIVACY_KINDS,
  PRIVACY_STATUSES,
  PRIVACY_STEP_STATUSES,
  PROPOSAL_STATUSES,
  QUOTE_LINE_KINDS,
  QUOTE_STATUSES,
  REASSESSMENT_OUTCOMES,
  REDEMPTION_STATUSES,
  REFUND_STATES,
  REMEDY_COVERAGES,
  REVISION_REASONS,
  SAMPLE_STATES,
  STAFF_ROLES,
  STUDIO_STEPS,
} from "./enums";
import { JACKET_COMFORT, MOVEMENT_OPTIONS, POSTURE_OPTIONS, TROUSER_COMFORT, UNITS } from "./measurements";
import {
  BREASTS,
  BUTTON_STANCES,
  CANVASES,
  GARMENTS,
  HEMS,
  LAPEL_WIDTHS,
  LAPELS,
  MONOGRAM_FONTS,
  MONOGRAM_PLACEMENTS,
  MONOGRAM_THREADS,
  PLEATS,
  POCKETS,
  RISES,
  SHOULDERS,
  SLEEVE_BUTTONS,
  TROUSER_FITS,
  VENTS,
  WAISTBANDS,
  WAISTCOAT_BACKS,
  WAISTCOAT_LAPELS,
  WAISTCOAT_STYLES,
} from "./spec";

export const vStaffRole = literals(STAFF_ROLES);
export const vOccasion = literals(OCCASIONS);
export const vStudioStep = literals(STUDIO_STEPS);
export const vDraftStatus = literals(DRAFT_STATUSES);
export const vFitRoute = literals(FIT_ROUTES);
export const vRevisionReason = literals(REVISION_REASONS);
export const vCatalogueKind = literals(CATALOGUE_KINDS);
export const vCatalogueStatus = literals(CATALOGUE_STATUSES);
export const vClothWeight = literals(CLOTH_WEIGHTS);
export const vClothPattern = literals(CLOTH_PATTERNS);
export const vCaseKind = literals(CASE_KINDS);
export const vCaseStatus = literals(CASE_STATUSES);
export const vCasePriority = literals(CASE_PRIORITIES);
export const vMessageAuthor = literals(MESSAGE_AUTHORS);
export const vProposalStatus = literals(PROPOSAL_STATUSES);
export const vCommercialImpact = literals(COMMERCIAL_IMPACTS);
export const vContactChannel = literals(CONTACT_CHANNELS);
export const vSampleState = literals(SAMPLE_STATES);
export const vAppointmentService = literals(APPOINTMENT_SERVICES);
export const vAppointmentStatus = literals(APPOINTMENT_STATUSES);
export const vAppointmentPeriod = literals(APPOINTMENT_PERIODS);
export const vAppointmentActor = literals(APPOINTMENT_ACTORS);
export const vQuoteStatus = literals(QUOTE_STATUSES);
export const vQuoteLineKind = literals(QUOTE_LINE_KINDS);
export const vRedemptionStatus = literals(REDEMPTION_STATUSES);
export const vOrderStatus = literals(ORDER_STATUSES);
export const vPaymentState = literals(PAYMENT_STATES);
export const vMilestoneSource = literals(MILESTONE_SOURCES);
/**
 * Milestone kinds the house records by hand on a commission (`orders.addMilestone`). The other kinds are
 * written only by the action that makes them true: quote_accepted by the quote's acceptance, payment by
 * recordPayment, released by release, delivered by markDelivered, fit_accepted by the client's acceptance
 * and correction_opened by a correction.
 */
export const PRODUCTION_MILESTONE_KINDS = [
  "cloth_cut",
  "making",
  "quality_review",
  "shipped",
  "collected",
  "fit_review",
  "risk",
  "estimated_ready",
  "note",
] as const satisfies readonly OrderMilestoneKind[];
export type ProductionMilestoneKind = (typeof PRODUCTION_MILESTONE_KINDS)[number];
export const vProductionMilestoneKind = literals(PRODUCTION_MILESTONE_KINDS);
export const vChecklistState = literals(CHECKLIST_STATES);
export const vFitRegion = literals(FIT_REGIONS);
export const vCorrectionKind = literals(CORRECTION_KINDS);
export const vCorrectionStatus = literals(CORRECTION_STATUSES);
export const vRemedyCoverage = literals(REMEDY_COVERAGES);
export const vRefundState = literals(REFUND_STATES);
export const vReassessmentOutcome = literals(REASSESSMENT_OUTCOMES);
export const vFitProfileStatus = literals(FIT_PROFILE_STATUSES);
export const vFitProvenance = literals(FIT_PROVENANCES);
export const vFitPhotoPose = literals(FIT_PHOTO_POSES);
export const vPreviewStatus = literals(PREVIEW_STATUSES);
export const vPreviewQuality = literals(PREVIEW_QUALITIES);
export const vPhotoStatus = literals(PHOTO_STATUSES);
export const vPrivacyKind = literals(PRIVACY_KINDS);
export const vPrivacyStatus = literals(PRIVACY_STATUSES);
export const vPrivacyStepStatus = literals(PRIVACY_STEP_STATUSES);
export const vGroupStatus = literals(GROUP_STATUSES);
export const vParticipantStatus = literals(PARTICIPANT_STATUSES);
export const vNotificationChannel = literals(NOTIFICATION_CHANNELS);
export const vNotificationStatus = literals(NOTIFICATION_STATUSES);
export const vAuditActorKind = literals(AUDIT_ACTOR_KINDS);
export const vUnit = literals(UNITS);
export const vJacketComfort = literals(JACKET_COMFORT);
export const vTrouserComfort = literals(TROUSER_COMFORT);
export const vMovement = literals(MOVEMENT_OPTIONS);
export const vPosture = literals(POSTURE_OPTIONS);

export const vJacketSpec = v.object({
  breast: literals(BREASTS),
  buttons: literals(BUTTON_STANCES),
  lapel: literals(LAPELS),
  lapelWidth: literals(LAPEL_WIDTHS),
  vents: literals(VENTS),
  pockets: literals(POCKETS),
  ticketPocket: v.boolean(),
  canvas: literals(CANVASES),
  shoulder: literals(SHOULDERS),
  sleeveButtons: literals(SLEEVE_BUTTONS),
  workingCuffs: v.boolean(),
});

export const vTrouserSpec = v.object({
  fit: literals(TROUSER_FITS),
  pleats: literals(PLEATS),
  rise: literals(RISES),
  hem: literals(HEMS),
  waistband: literals(WAISTBANDS),
});

export const vWaistcoatSpec = v.object({
  style: literals(WAISTCOAT_STYLES),
  lapel: literals(WAISTCOAT_LAPELS),
  back: literals(WAISTCOAT_BACKS),
});

export const vMonogram = v.object({
  text: v.string(),
  placement: literals(MONOGRAM_PLACEMENTS),
  thread: literals(MONOGRAM_THREADS),
  font: literals(MONOGRAM_FONTS),
});

/** Mirrors `SuitSpec` in spec.ts; `Infer<typeof vSuitSpec>` is assignable to it and back. */
export const vSuitSpec = v.object({
  garment: literals(GARMENTS),
  clothCode: v.union(v.string(), v.null()),
  jacket: vJacketSpec,
  trousers: vTrouserSpec,
  waistcoat: v.union(vWaistcoatSpec, v.null()),
  buttonCode: v.union(v.string(), v.null()),
  liningCode: v.union(v.string(), v.null()),
  monogram: v.union(vMonogram, v.null()),
});
export type SuitSpecValue = Infer<typeof vSuitSpec>;

/** The client's change request: top-level fields replace, the garment parts merge (spec.ts `SpecPatch`). */
export const vSpecPatch = v.object({
  garment: v.optional(literals(GARMENTS)),
  clothCode: v.optional(v.union(v.string(), v.null())),
  jacket: v.optional(vJacketSpec.partial()),
  trousers: v.optional(vTrouserSpec.partial()),
  waistcoat: v.optional(v.union(vWaistcoatSpec.partial(), v.null())),
  buttonCode: v.optional(v.union(v.string(), v.null())),
  liningCode: v.optional(v.union(v.string(), v.null())),
  monogram: v.optional(v.union(vMonogram, v.null())),
});

export const vConflict = v.object({
  field: v.string(),
  label: v.string(),
  from: v.string(),
  to: v.string(),
  reason: v.string(),
});

export const vDescribedLine = v.object({
  section: v.union(
    v.literal("Garment"),
    v.literal("Cloth"),
    v.literal("Jacket"),
    v.literal("Trousers"),
    v.literal("Waistcoat"),
    v.literal("Details"),
  ),
  label: v.string(),
  value: v.string(),
  productionId: v.optional(v.string()),
});

export const vContact = v.object({
  name: v.string(),
  email: v.string(),
  phone: v.optional(v.string()),
  preferredShowroom: v.optional(v.union(v.literal("charlotte"), v.literal("atlanta"), v.literal("houston"))),
  channel: vContactChannel,
});

export const vPostalAddress = v.object({
  line1: v.string(),
  line2: v.optional(v.string()),
  city: v.string(),
  region: v.string(),
  postalCode: v.string(),
  country: v.string(),
});

export const vSampleRequest = v.object({
  clothCode: v.string(),
  address: vPostalAddress,
  state: vSampleState,
});

export const vPreferredWindow = v.object({ date: v.number(), period: vAppointmentPeriod });

export const vAppointmentHistoryEntry = v.object({
  at: v.number(),
  from: vAppointmentStatus,
  to: vAppointmentStatus,
  by: vAppointmentActor,
  note: v.optional(v.string()),
});

export const vQuoteLine = v.object({
  code: v.string(),
  label: v.string(),
  amountUsd: v.number(),
  kind: vQuoteLineKind,
});

export const vQuoteBenefit = v.object({
  tier: v.string(),
  redemptionId: v.id("atelierBenefitRedemptions"),
  description: v.string(),
});

export const vPayment = v.object({
  state: vPaymentState,
  amountUsd: v.optional(v.number()),
  reference: v.optional(v.string()),
  confirmedAt: v.optional(v.number()),
  provider: v.optional(v.string()),
});

export const vRemedy = v.object({
  kind: vCorrectionKind,
  coverage: vRemedyCoverage,
  amountUsd: v.optional(v.number()),
  logistics: v.string(),
  deadline: v.optional(v.number()),
  approvedByStaffId: v.id("users"),
});

export const vRefund = v.object({
  state: vRefundState,
  amountUsd: v.optional(v.number()),
  confirmedAt: v.optional(v.number()),
  reference: v.optional(v.string()),
});

export const vReassessment = v.object({
  at: v.number(),
  outcome: vReassessmentOutcome,
  note: v.string(),
});

export const vPrivacyStep = v.object({
  key: v.string(),
  label: v.string(),
  status: vPrivacyStepStatus,
  at: v.optional(v.number()),
  note: v.optional(v.string()),
});

export const vFitComfort = v.object({
  jacket: vJacketComfort,
  trousers: vTrouserComfort,
  movement: v.array(vMovement),
});

export const vPhotoValidation = v.object({ ok: v.boolean(), reasons: v.array(v.string()) });

export const vParticipantConsent = v.object({ shareStyleStatus: v.boolean(), shareFitStatus: v.boolean() });

/** Season reuse so cloth seasons use the wardrobe's own words. */
export const vClothSeason = vSeason;
