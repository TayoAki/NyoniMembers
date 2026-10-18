import type { DraftStatus } from "@convex/shared/atelier/enums";

/** The save scope, in the exact words of the state-language table (contract §6). */
export function savedScopeWords(ownedByAccount: boolean): string {
  return ownedByAccount ? "Saved to your account" : "Saved to this browser";
}

/**
 * Words for a draft's status in the drafts list. `enums.ts` has no label map for `DRAFT_STATUSES`
 * (reported); these stay in the house's voice and never say "ordered" or "booked".
 */
export const DRAFT_STATUS_WORDS: Record<DraftStatus, string> = {
  draft: "In the studio",
  submitted: "Submitted to the house",
  archived: "Archived",
};
