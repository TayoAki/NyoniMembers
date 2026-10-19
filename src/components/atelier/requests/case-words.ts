import type { StatusTone } from "@/components/atelier/common/status-line";
import { formatDate } from "@/lib/format";
import type { CaseMessageView, CaseSummary, CaseView } from "@convex/atelier/cases";
import type { QuoteLineView, QuoteView } from "@convex/atelier/quotes";
import type {
  CaseStatus,
  ContactChannel,
  PaymentState,
  ProposalStatus,
  QuoteLineKind,
  QuoteStatus,
} from "@convex/shared/atelier/enums";
import { ATELIER_LIMITS, QUOTE_LINE_KINDS } from "@convex/shared/atelier/enums";
import { HOUSE_POLICY } from "@convex/shared/atelier/policy";
import type { DescribedLine } from "@convex/shared/atelier/spec";
import type { Infer } from "convex/values";
import type { vContact } from "@convex/shared/atelier/validators";

type Contact = Infer<typeof vContact>;

/** Colour never carries the meaning alone; gold marks the states that wait on the client. */
export const CASE_TONES: Record<CaseStatus, StatusTone> = {
  received: "neutral",
  assigned: "neutral",
  awaiting_client: "gold",
  awaiting_staff: "neutral",
  completed: "success",
  cancelled: "neutral",
};

export const PROPOSAL_TONES: Record<ProposalStatus, StatusTone> = {
  proposed: "gold",
  accepted: "success",
  rejected: "neutral",
  withdrawn: "neutral",
};

export const QUOTE_TONES: Record<QuoteStatus, StatusTone> = {
  draft: "neutral",
  offered: "gold",
  accepted: "success",
  expired: "warning",
  superseded: "neutral",
  withdrawn: "neutral",
};

export const PAYMENT_TONES: Record<PaymentState, StatusTone> = {
  none: "neutral",
  pending: "neutral",
  confirmed: "success",
  failed: "warning",
  refunded_partial: "neutral",
  refunded: "neutral",
};

export const CHANNEL_WORDS: Record<ContactChannel, string> = {
  email: "Email",
  sms: "Text message",
  either: "Email or text message",
};

/** The client's own message cap; mirrors `CASE_TEXT_MAX` in convex/model/atelier/cases.ts, which is not exported to the client. */
export const MESSAGE_MAX_CHARS: number = ATELIER_LIMITS.caseTextMax;

/** The exact words of the state-language table (contract §6) and of the requests brief. */
export const QUOTE_ACCEPTED_WORDS = "Quote accepted · payment not yet recorded";
export const STALE_PROPOSAL_SENTENCE =
  "Your design changed since this was proposed — ask your concierge to propose again.";
export const NO_CHECKOUT_SENTENCE =
  "The house records payment from its own system. There is no checkout here, and nothing on this page takes a card.";
export const RECORD_SENTENCE =
  "Writing to you is our intent, not proof of delivery; this page is the record of your request, whatever reaches your inbox.";

/** Who wrote a message: the client, the named concierge, or the house's own notes. */
export function authorWords(message: Pick<CaseMessageView, "author" | "authorName">): string {
  if (message.author === "client") return "You";
  if (message.author === "staff") return message.authorName ?? "Your concierge";
  return "The house";
}

/** The status words for a list row: the label, then the concierge's first name when one holds it. */
export function statusWords(request: Pick<CaseSummary, "statusLabel" | "ownerFirstName" | "status">): string {
  const named = request.ownerFirstName && request.status !== "received" && request.status !== "cancelled";
  return named ? `${request.statusLabel} · ${request.ownerFirstName}` : request.statusLabel;
}

/** One sentence on what happens next, true for the status as it stands. */
export function nextWords(request: Pick<CaseView, "status" | "closedAt">): string {
  switch (request.status) {
    case "received":
    case "assigned":
      return HOUSE_POLICY.proposed.responseTime;
    case "awaiting_staff":
      return `Your message is with the house. ${HOUSE_POLICY.proposed.responseTime}`;
    case "awaiting_client":
      return "The house is waiting on you: a proposal, a quote or a message below needs your answer.";
    case "completed":
      return `Completed${request.closedAt ? ` ${formatDate(request.closedAt)}` : ""}. The conversation stays on record.`;
    case "cancelled":
      return "Cancelled. Nothing further happens on this request; your design is unchanged.";
  }
}

/** Where the house intends to write, in the client's own channel words. */
export function notificationWords(contact: Pick<Contact, "email" | "phone" | "channel">): string {
  if (contact.channel === "sms" && contact.phone) return `We will text ${contact.phone} when there is news.`;
  if (contact.channel === "either" && contact.phone)
    return `We will write to ${contact.email} or text ${contact.phone} when there is news.`;
  return `We will write to ${contact.email} when there is news.`;
}

export function impactWords(impact: "none" | "new_quote"): string {
  return impact === "new_quote"
    ? "A new quote will follow if you accept; any quote offered on this request is replaced."
    : "Your quote is unaffected by this change.";
}

/** "Expires", "Expired", "Accepted" — the word that is true for the quote today. */
export function expiryWords(quote: Pick<QuoteView, "status" | "expiresAt" | "acceptedAt">, now: number): string {
  const day = formatDate(quote.expiresAt);
  if (quote.status === "accepted") return quote.acceptedAt ? `Accepted ${formatDate(quote.acceptedAt)}` : "Accepted";
  if (quote.status === "expired" || (quote.status === "offered" && quote.expiresAt <= now)) return `Expired ${day}`;
  if (quote.status === "offered") return `Expires ${day}`;
  return `Was to expire ${day}`;
}

export function isQuoteExpired(quote: Pick<QuoteView, "status" | "expiresAt">, now: number): boolean {
  return quote.status === "expired" || (quote.status === "offered" && quote.expiresAt <= now);
}

const SECTION_ORDER: readonly DescribedLine["section"][] = [
  "Garment",
  "Cloth",
  "Jacket",
  "Trousers",
  "Waistcoat",
  "Details",
];

export type LineGroup = { section: DescribedLine["section"]; lines: DescribedLine[] };

/** Order-book lines grouped in the garment's reading order, empty sections dropped. */
export function groupLines(lines: readonly DescribedLine[]): LineGroup[] {
  return SECTION_ORDER.map((section) => ({ section, lines: lines.filter((line) => line.section === section) })).filter(
    (group) => group.lines.length > 0,
  );
}

export type QuoteLineGroup = { kind: QuoteLineKind; kindLabel: string; lines: QuoteLineView[] };

/** Quote lines by kind in the house's order (commission, cloth, options, shipping, tax, benefit, discount). */
export function groupQuoteLines(lines: readonly QuoteLineView[]): QuoteLineGroup[] {
  return QUOTE_LINE_KINDS.map((kind) => {
    const matching = lines.filter((line) => line.kind === kind);
    return { kind, kindLabel: matching[0]?.kindLabel ?? kind, lines: matching };
  }).filter((group) => group.lines.length > 0);
}

export function lineKey(line: Pick<DescribedLine, "section" | "label">): string {
  return `${line.section}·${line.label}`;
}
