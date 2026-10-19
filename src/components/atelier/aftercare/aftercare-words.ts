import type { StatusTone } from "@/components/atelier/common/status-line";
import type { CorrectionView } from "@convex/atelier/corrections";
import type { OrderView } from "@convex/atelier/orders";
import {
  ATELIER_LIMITS,
  type CorrectionKind,
  type CorrectionStatus,
  type FitRegion,
  type RefundState,
} from "@convex/shared/atelier/enums";
import { HOUSE_POLICY } from "@convex/shared/atelier/policy";

/** Gold for what waits on the client (a remedy to accept, a reassessment to give), warning for an escalation. */
export const CORRECTION_TONES: Record<CorrectionStatus, StatusTone> = {
  requested: "neutral",
  triaged: "neutral",
  remedy_proposed: "gold",
  accepted: "neutral",
  in_progress: "neutral",
  received: "neutral",
  completed: "gold",
  escalated: "warning",
  declined: "neutral",
  closed: "neutral",
};

export const REFUND_TONES: Record<RefundState, StatusTone> = {
  none: "neutral",
  approved: "neutral",
  processing: "neutral",
  refunded: "success",
};

/** Mirror `CORRECTION_TEXT_MAX` and `CORRECTION_PHOTOS_MAX` in convex/model/atelier/corrections.ts (not imported into the client bundle). */
export const CORRECTION_TEXT_MAX: number = ATELIER_LIMITS.correctionTextMax;
export const CORRECTION_PHOTOS_MAX: number = ATELIER_LIMITS.correctionPhotosMax;

/** The two kinds raised from the first-fit checklist (S31) and the four the policy section offers (S32). */
export const AFTERCARE_KINDS: readonly CorrectionKind[] = ["alteration", "remake"];
export const COMMERCE_KINDS: readonly CorrectionKind[] = ["cancellation", "return", "exchange", "refund"];

export function isAftercareKind(kind: CorrectionKind): boolean {
  return AFTERCARE_KINDS.includes(kind);
}

/** A kind that names a region of the garment; the others describe the commission as a whole. */
export function takesRegion(kind: CorrectionKind): boolean {
  return isAftercareKind(kind);
}

export const KIND_NOTES: Record<CorrectionKind, string> = {
  alteration: `A fit or finishing adjustment to the suit you have. ${HOUSE_POLICY.verified.alterations}`,
  remake: "The garment, or a part of it, made again to the same specification when an alteration cannot put it right.",
  return: `${HOUSE_POLICY.verified.finalSale} Your concierge tells you what applies to this commission before anything is arranged.`,
  exchange: `${HOUSE_POLICY.verified.refunds} Your concierge confirms whether this commission is inside that window.`,
  refund: `${HOUSE_POLICY.verified.refunds} ${HOUSE_POLICY.verified.storeCredit}`,
  cancellation: HOUSE_POLICY.verified.finalSale,
};

/** The verb for each kind on its action, so a request is never called a cancellation or a refund before the house decides. */
export const KIND_ACTIONS: Record<CorrectionKind, string> = {
  alteration: "Request an alteration",
  remake: "Ask for a remake",
  return: "Ask about a return",
  exchange: "Ask about an exchange",
  refund: "Ask about store credit or a refund",
  cancellation: "Ask to cancel",
};

export const REFUND_TRUTH =
  "“Refund approved” is not “Refunded”: the house records a refund only when its payment system confirms it, with a reference.";
export const REQUEST_RECEIVED = "Request received";
export const PHOTO_SENTENCE =
  "Photographs are optional. They are seen only by the house, for this correction, and used for nothing else.";
export const DETAIL_MISMATCH_SENTENCE =
  "You reported a detail that does not match the design. The house checks the garment against the specification you approved, line by line. This is a manufacturing check, not a fit correction, and your fit profile is unchanged.";
export const HOUSE_REVIEW_SENTENCE =
  "A member of the house reviews every cancellation after release and replies on your request. Nothing is cancelled until they confirm it.";
export const ESCALATED_SENTENCE =
  "A senior member of the house decides on this one and replies on your request; you will not be asked to describe it again.";
export const SPEC_UNCHANGED_SENTENCE =
  "A correction never rewrites the released order: the specification and the fit profile it was cut to stay on record.";

/** What a correction form is for: a fresh `key` makes a fresh form (and submission key) for each intent. */
export type CorrectionIntent = { key: number; kind: CorrectionKind; region: FitRegion | null };

/** Whether a cancellation of this commission is confirmed by the house (before release) or reviewed by it (after). */
export function cancellationNote(order: Pick<OrderView, "status" | "releasedAt">): string {
  if (order.status === "cancelled") return "This commission was cancelled.";
  if (order.status === "preflight" && order.releasedAt === null) {
    return "Your commission has not been released to the cutter. The house confirms the cancellation on your request before anything else happens.";
  }
  return `Your commission has been released to the cutter. ${HOUSE_POLICY.verified.finalSale} ${HOUSE_REVIEW_SENTENCE}`;
}

export function reassessmentWords(reassessment: NonNullable<CorrectionView["reassessment"]>): string {
  return reassessment.outcome === "resolved" ? "Resolved: the fit is right" : "Still an issue";
}

/** How a correction summary reads in a list: the kind, then the region when one was named. */
export function correctionTitle(c: { kindLabel: string; regionLabel: string | null }): string {
  return c.regionLabel ? `${c.kindLabel} · ${c.regionLabel}` : c.kindLabel;
}
