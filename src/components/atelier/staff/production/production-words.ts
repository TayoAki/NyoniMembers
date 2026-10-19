import type { StatusTone } from "@/components/atelier/common/status-line";
import {
  MILESTONE_KIND_LABELS,
  MILESTONE_SOURCE_LABELS,
  ORDER_MILESTONE_KINDS,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  type MilestoneSource,
  type OrderMilestoneKind,
  type OrderStatus,
  type PaymentState,
} from "@convex/shared/atelier/enums";
import { PAYMENT_TRANSITIONS, STATUS_FOR_MILESTONE } from "@convex/shared/atelier/transitions";

/**
 * Words for the production desk (A05, O05). Status words the client reads come from the views
 * (`statusLabel`, `payment.stateLabel`, milestone `label`/`sourceLabel`). This file adds tones, the
 * desk's short filter names (each tab also quotes the client's words), and mirrors of two lists that
 * live in `convex/model/atelier/orders.ts` (a server module client code must not import): the
 * milestone kinds and the payment transitions. Listed under backendGaps so the lead can move them.
 */

export const PRODUCTION_TITLE = "Production";
export const PRODUCTION_DESCRIPTION =
  "Every commission an accepted quote opened: what blocks its release, what the cutter has, where the parcel is. Each status word here is the one the client reads on their order.";

export const ORDER_STATUS_TONES: Record<OrderStatus, StatusTone> = {
  preflight: "warning",
  released: "neutral",
  making: "neutral",
  quality_review: "neutral",
  shipped: "neutral",
  collected: "neutral",
  fit_review: "warning",
  accepted: "success",
  correction_open: "warning",
  cancelled: "neutral",
};

export const PAYMENT_STATE_TONES: Record<PaymentState, StatusTone> = {
  none: "warning",
  pending: "warning",
  confirmed: "success",
  failed: "destructive",
  refunded_partial: "neutral",
  refunded: "neutral",
};

/** Short names for the desk's filters; the client's words are quoted beside them. */
export const STAFF_STATUS_WORDS: Record<OrderStatus, string> = {
  preflight: "Preflight",
  released: "Released",
  making: "Making",
  quality_review: "Quality review",
  shipped: "Shipped",
  collected: "Collected",
  fit_review: "Fit review",
  accepted: "Fit accepted",
  correction_open: "Correction open",
  cancelled: "Cancelled",
};

export const PRODUCTION_FILTERS = ["all", ...ORDER_STATUSES] as const;
export type ProductionFilter = (typeof PRODUCTION_FILTERS)[number];

export function isProductionFilter(value: string | null | undefined): value is ProductionFilter {
  return value !== null && value !== undefined && (PRODUCTION_FILTERS as readonly string[]).includes(value);
}

export function filterDescription(filter: ProductionFilter): string {
  if (filter === "all") return "Every commission, most recent activity first.";
  return `Commissions the client reads as “${ORDER_STATUS_LABELS[filter]}”.`;
}

export { MILESTONE_KIND_LABELS, ORDER_MILESTONE_KINDS, STATUS_FOR_MILESTONE, type OrderMilestoneKind };

/** The kinds the desk records by hand; the others are written by their own action (release, payment, shipping, risk). */
export const HAND_RECORDED_KINDS: readonly OrderMilestoneKind[] = [
  "cloth_cut",
  "making",
  "quality_review",
  "collected",
  "fit_review",
  "estimated_ready",
  "note",
];

/** How the desk names a source; the client reads MILESTONE_SOURCE_LABELS (where "client" is "You"). */
export const MILESTONE_SOURCE_STAFF_WORDS: Record<MilestoneSource, string> = {
  ...MILESTONE_SOURCE_LABELS,
  client: "The client",
};

export { PAYMENT_TRANSITIONS };

export const SHIPPABLE_STATUSES: readonly OrderStatus[] = ["released", "making", "quality_review"];
export const DELIVERABLE_STATUSES: readonly OrderStatus[] = ["shipped", "collected"];
