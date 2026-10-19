import type { StatusTone } from "@/components/atelier/common/status-line";
import { formatDate, pluralize } from "@/lib/format";
import type { QuoteStatus } from "@convex/shared/atelier/enums";

/**
 * Words for the quotes desk (A04, O04). Status words come from the view's `statusLabel`
 * (QUOTE_STATUS_LABELS); this file adds tones and the expiry phrasing.
 */

export const QUOTES_TITLE = "Quotes";
export const QUOTES_DESCRIPTION =
  "Quotes offered to clients, soonest to expire first, then those still being prepared. Pricing happens on the request itself; this desk shows what is waiting on a client and what is about to lapse.";

export const QUOTE_STATUS_TONES: Record<QuoteStatus, StatusTone> = {
  draft: "neutral",
  offered: "warning",
  accepted: "success",
  expired: "destructive",
  superseded: "neutral",
  withdrawn: "neutral",
};

const DAY_MS = 86_400_000;
/** An offered quote within this many days of its expiry is called out. */
export const EXPIRING_SOON_DAYS = 3;

export type ExpiryWords = { words: string; tone: StatusTone; soon: boolean };

/**
 * "Expires" is the client's word too; the desk adds how soon, in days, never a countdown clock. The hourly
 * check expires offered quotes only: a draft whose expiry has passed stays "Being prepared" until finance
 * supersedes it with a new version, and the words say so rather than promising a check that never comes.
 */
export function expiryWords(expiresAt: number, now: number, status: QuoteStatus): ExpiryWords {
  if (status !== "offered" && status !== "draft") {
    return { words: `Expiry was ${formatDate(expiresAt)}`, tone: "neutral", soon: false };
  }
  const daysLeft = Math.ceil((expiresAt - now) / DAY_MS);
  if (expiresAt <= now) {
    return status === "draft"
      ? {
          words: `Expiry ${formatDate(expiresAt)} has passed · replace it with a new version`,
          tone: "warning",
          soon: true,
        }
      : {
          words: `Expired ${formatDate(expiresAt)} · the hourly check will mark it`,
          tone: "destructive",
          soon: true,
        };
  }
  if (daysLeft <= 0) return { words: "Expires today", tone: "warning", soon: true };
  if (daysLeft <= EXPIRING_SOON_DAYS) {
    return { words: `Expires in ${pluralize(daysLeft, "day")} · expiring soon`, tone: "warning", soon: true };
  }
  return { words: `Expires ${formatDate(expiresAt)}`, tone: "neutral", soon: false };
}
