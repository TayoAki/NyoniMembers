import type { StatusTone } from "@/components/atelier/common/status-line";
import type { QueueFilter } from "@convex/atelier/cases";
import { ATELIER_LIMITS, type CasePriority, type CaseStatus } from "@convex/shared/atelier/enums";

export const QUEUE_TITLE = "Atelier desk";
export const QUEUE_DESCRIPTION =
  "Every request a client has sent, once. Give each one a named owner and a real next action; the client reads the same owner and status you see here.";

/** The five queue filters the backend serves (`cases.queue`), in the order the desk shows them. */
export const QUEUE_FILTERS = [
  "unassigned",
  "mine",
  "overdue",
  "awaiting_client",
  "all",
] as const satisfies readonly QueueFilter[];

export function isQueueFilter(value: string | null | undefined): value is QueueFilter {
  return value !== null && value !== undefined && (QUEUE_FILTERS as readonly string[]).includes(value);
}

export const QUEUE_FILTER_LABELS: Record<QueueFilter, string> = {
  unassigned: "Unassigned",
  mine: "Mine",
  overdue: "Overdue",
  awaiting_client: "Awaiting client",
  all: "All",
};

export const QUEUE_FILTER_DESCRIPTIONS: Record<QueueFilter, string> = {
  unassigned: "Open requests nobody has taken. Longest waiting first, high priority on top.",
  mine: "Open requests you own.",
  overdue: `Unassigned for more than ${ATELIER_LIMITS.assignWithinHours} hours, a next action past its date, or escalated by the house's rule.`,
  awaiting_client: "Requests waiting on the client's reply.",
  all: "Every request, open or closed, most recent activity first.",
};

export const QUEUE_EMPTY_WORDS: Record<QueueFilter, { title: string; description: string }> = {
  unassigned: { title: "Nothing is waiting for a concierge", description: "Every open request has an owner." },
  mine: { title: "You own no open requests", description: "Take one from the unassigned queue to start." },
  overdue: { title: "Nothing is overdue", description: "No request has waited past the house's rule." },
  awaiting_client: { title: "Nothing is waiting on a client", description: "Every open request is with the house." },
  all: {
    title: "No requests yet",
    description: "A request appears here the moment a client sends one from the Atelier.",
  },
};

/** Priority as words, never colour alone (S&S contract). */
export const PRIORITY_WORDS: Record<CasePriority, string> = {
  normal: "Normal",
  high: "High priority",
};

export const CASE_STATUS_TONES: Record<CaseStatus, StatusTone> = {
  received: "warning",
  assigned: "neutral",
  awaiting_client: "neutral",
  awaiting_staff: "warning",
  completed: "success",
  cancelled: "neutral",
};
