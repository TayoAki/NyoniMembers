import type { StatusTone } from "@/components/atelier/common/status-line";
import { PROPOSAL_STATUS_LABELS, QUOTE_LINE_KIND_LABELS, SAMPLE_STATE_LABELS } from "@convex/shared/atelier/enums";
import { APPOINTMENT_TRANSITIONS, CASE_TRANSITIONS, SAMPLE_TRANSITIONS } from "@convex/shared/atelier/transitions";
import { computeTotals, validateLines } from "@convex/shared/atelier/quote_lines";
import type {
  CommercialImpact,
  MessageAuthor,
  NotificationStatus,
  ProposalStatus,
  QuoteStatus,
  SampleState,
} from "@convex/shared/atelier/enums";

/**
 * Words and rules the case desk needs that live in the backend's model files rather than in
 * `convex/shared/atelier/enums.ts`. They are re-exported from one place so the import can move when the
 * lead relocates them. Anything the server already labels (statusLabel, stateLabel, kindLabel) is read
 * from the view instead of looked up here.
 */
export {
  APPOINTMENT_TRANSITIONS,
  CASE_TRANSITIONS,
  computeTotals,
  PROPOSAL_STATUS_LABELS,
  QUOTE_LINE_KIND_LABELS,
  SAMPLE_STATE_LABELS,
  SAMPLE_TRANSITIONS,
  validateLines,
};

/** The sample fulfilment steps a concierge may record from the current one, with the words the client will read. */
export function nextSampleStates(from: SampleState): readonly SampleState[] {
  return SAMPLE_TRANSITIONS[from];
}

export const SAMPLE_STATE_TONES: Record<SampleState, StatusTone> = {
  requested: "warning",
  accepted: "neutral",
  shipped: "success",
  declined: "neutral",
};

export const PROPOSAL_STATUS_TONES: Record<ProposalStatus, StatusTone> = {
  proposed: "warning",
  accepted: "success",
  rejected: "neutral",
  withdrawn: "neutral",
};

export const QUOTE_STATUS_TONES: Record<QuoteStatus, StatusTone> = {
  draft: "neutral",
  offered: "warning",
  accepted: "success",
  expired: "destructive",
  superseded: "neutral",
  withdrawn: "neutral",
};

/** What a proposed change means commercially, said the way the client will read it. */
export const COMMERCIAL_IMPACT_WORDS: Record<CommercialImpact, { label: string; description: string }> = {
  none: { label: "No change to the price", description: "The offered quote, if any, stays as it is." },
  new_quote: {
    label: "A new quote will follow",
    description: "Accepting supersedes the offered quote; finance prepares a fresh version for approval.",
  },
};

/** Who wrote a message, from the desk's side of the table. */
export function authorWords(author: MessageAuthor, authorName: string | null, clientFirstName: string): string {
  if (author === "client") return clientFirstName;
  if (author === "staff") return authorName ?? "The house";
  return "The house";
}

/** Delivery words for notification records: nothing is "sent" until a sender says so. */
export const NOTIFICATION_STATUS_WORDS: Record<NotificationStatus, string> = {
  queued: "Queued · not yet sent",
  sent: "Sent",
  delivered: "Delivered",
  failed: "Failed",
};

export const NOTIFICATION_STATUS_TONES: Record<NotificationStatus, StatusTone> = {
  queued: "warning",
  sent: "neutral",
  delivered: "success",
  failed: "destructive",
};
