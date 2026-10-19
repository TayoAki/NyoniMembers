import type { StatusTone } from "@/components/atelier/common/status-line";
import type { OrderView } from "@convex/atelier/orders";
import type { OrderStatus } from "@convex/shared/atelier/enums";
import { HOUSE_POLICY } from "@convex/shared/atelier/policy";

/** Colour never carries the meaning alone; gold marks what waits on the client, warning what needs attention. */
export const ORDER_TONES: Record<OrderStatus, StatusTone> = {
  preflight: "neutral",
  released: "neutral",
  making: "neutral",
  quality_review: "neutral",
  shipped: "neutral",
  collected: "neutral",
  fit_review: "gold",
  accepted: "success",
  correction_open: "warning",
  cancelled: "neutral",
};

/**
 * Mirrors `IN_HAND_ORDER_STATUSES` (convex/model/atelier/corrections.ts) and `CHECKLIST_STATUSES`
 * (convex/model/atelier/orders.ts); the model files are not imported into the client bundle.
 */
export const IN_HAND_STATUSES: readonly OrderStatus[] = [
  "shipped",
  "collected",
  "fit_review",
  "accepted",
  "correction_open",
];
export const CHECKLIST_STATUSES: readonly OrderStatus[] = ["shipped", "collected", "fit_review", "correction_open"];

export function isInHand(status: OrderStatus): boolean {
  return IN_HAND_STATUSES.includes(status);
}

/** The first-fit section shows from shipping onward; it stays readable once the fit is accepted. */
export function showsFirstFit(status: OrderStatus): boolean {
  return isInHand(status);
}

export function checklistEditable(status: OrderStatus): boolean {
  return CHECKLIST_STATUSES.includes(status);
}

/** The exact word beside every estimated date (contract §6). */
export const ESTIMATE_WORD = "Estimate";

export const SHIPPED_NOT_FITTED =
  "Shipped is not fitted: your fit review opens when the suit arrives, and the house refines anything that needs it.";

/** One sentence on what the status means for the client, true for the status as it stands. */
export function statusSentence(order: Pick<OrderView, "status">): string {
  switch (order.status) {
    case "preflight":
      return "The house is checking your commission before release: the accepted quote, the design revision, your fit route or profile, and payment. Nothing goes to the cutter until each is in order.";
    case "released":
      return `${HOUSE_POLICY.verified.leadTime} Any date you see before the house confirms it is an estimate.`;
    case "making":
      return "Your suit is being made. The house records each stage below; a ready date is an estimate until the house confirms it.";
    case "quality_review":
      return "The finished suit is being checked against your specification before it leaves the house.";
    case "shipped":
      return SHIPPED_NOT_FITTED;
    case "collected":
      return "You have the suit. Go through the first-fit checklist when you have tried it on; the house refines anything that needs it.";
    case "fit_review":
      return "Delivery is not a fitting. Go through the checklist below, then accept the fit or tell the house what needs refining.";
    case "accepted":
      return `You accepted the fit. ${HOUSE_POLICY.verified.alterations} Accepting did not waive that promise.`;
    case "correction_open":
      return "A correction is open on this suit. The house takes it up on your aftercare request below; nothing else moves until it is resolved.";
    case "cancelled":
      return "This commission was cancelled. Any refund is recorded separately, from the house's payment system, when it is made.";
  }
}

/** The garment words without the cloth name `specSummary` appends, so the cloth can be set in its own type. */
export function garmentWords(summary: string, clothName: string | null | undefined): string {
  if (!clothName) return summary;
  const suffix = ` · ${clothName}`;
  return summary.endsWith(suffix) ? summary.slice(0, -suffix.length) : summary;
}

/** A Convex document id as the URL carries it; anything else is "not found" before the server is asked. */
export function looksLikeOrderId(value: string): boolean {
  return /^[a-z0-9]{28,40}$/.test(value);
}
