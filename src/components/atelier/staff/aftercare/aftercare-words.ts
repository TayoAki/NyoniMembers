import type { StatusTone } from "@/components/atelier/common/status-line";
import {
  CORRECTION_TRANSITIONS,
  NOTE_REQUIRED_STATUSES,
  STAFF_SETTABLE_STATUSES,
} from "@convex/shared/atelier/transitions";
import {
  CORRECTION_STATUS_LABELS,
  CORRECTION_STATUSES,
  correctionStatusLabel,
  type CorrectionKind,
  type CorrectionStatus,
  type RefundState,
} from "@convex/shared/atelier/enums";

/**
 * Words for the aftercare desk (A07, O07). Status, kind, region, coverage and refund words come from the
 * views (`statusLabel`, `kindLabel`, `regionLabel`, `coverageLabel`, `refund.stateLabel`) and the enums'
 * label maps. This file adds tones, the filters, and mirrors of the correction state machine from
 * `convex/model/atelier/corrections.ts` (a server module client code must not import), listed under
 * backendGaps so the lead can move them beside the other transitions in `convex/shared/atelier/transitions.ts`.
 */

export const AFTERCARE_TITLE = "Aftercare";
export const AFTERCARE_DESCRIPTION =
  "Fit, quality, return and refund issues on released commissions. Triage against the original specification, propose a remedy with real coverage and timing, and confirm a refund only from the payment system's reference.";

export const CORRECTION_STATUS_TONES: Record<CorrectionStatus, StatusTone> = {
  requested: "warning",
  triaged: "neutral",
  remedy_proposed: "neutral",
  accepted: "neutral",
  in_progress: "neutral",
  received: "neutral",
  completed: "warning",
  escalated: "destructive",
  declined: "neutral",
  closed: "neutral",
};

export const REFUND_STATE_TONES: Record<RefundState, StatusTone> = {
  none: "neutral",
  approved: "warning",
  processing: "warning",
  refunded: "success",
};

export { CORRECTION_TRANSITIONS, NOTE_REQUIRED_STATUSES, STAFF_SETTABLE_STATUSES };

export function canTransition(from: CorrectionStatus, to: CorrectionStatus): boolean {
  return CORRECTION_TRANSITIONS[from].includes(to);
}

/** The statuses the desk may set by button from here, in the order the enum lists them. */
export function settableNextStatuses(from: CorrectionStatus): CorrectionStatus[] {
  return CORRECTION_STATUSES.filter(
    (status) => STAFF_SETTABLE_STATUSES.includes(status) && canTransition(from, status),
  );
}

/** What the client reads after a status is set; the status word itself is `correctionStatusLabel` (kind-aware for a cancellation). */
export function clientReadsAfter(status: CorrectionStatus, kind: CorrectionKind): string {
  const word = correctionStatusLabel(kind, status);
  switch (status) {
    case "completed":
      return kind === "cancellation"
        ? `“${word}”; the commission is cancelled and any refund is recorded separately. No reassessment is asked for`
        : `“${word}” and the question “Is the fit right now?”`;
    case "declined":
    case "closed":
      return `“${word}” with your note; the request closes`;
    default:
      return `“${word}”`;
  }
}

export const AFTERCARE_FILTERS = ["open", ...CORRECTION_STATUSES] as const;
export type AftercareFilter = (typeof AFTERCARE_FILTERS)[number];

export function isAftercareFilter(value: string | null | undefined): value is AftercareFilter {
  return value !== null && value !== undefined && (AFTERCARE_FILTERS as readonly string[]).includes(value);
}

/** Short names for the filters; the client's words are quoted beside them. */
export const STAFF_STATUS_WORDS: Record<CorrectionStatus, string> = {
  requested: "Requested",
  triaged: "Triaged",
  remedy_proposed: "Remedy proposed",
  accepted: "Remedy accepted",
  in_progress: "In progress",
  received: "Received",
  completed: "Completed",
  escalated: "Escalated",
  declined: "Declined",
  closed: "Closed",
};

export function aftercareFilterDescription(filter: AftercareFilter): string {
  if (filter === "open") return "Every correction still open, newest first.";
  return `Corrections the client reads as “${CORRECTION_STATUS_LABELS[filter]}”.`;
}
