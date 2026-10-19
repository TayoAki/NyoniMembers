import type { StatusTone } from "@/components/atelier/common/status-line";
import { GROUP_TRANSITIONS } from "@convex/shared/atelier/transitions";
import type { GroupReviewStatus } from "@convex/atelier/groups";
import { GROUP_STATUS_LABELS, type GroupStatus, type ParticipantStatus } from "@convex/shared/atelier/enums";

/**
 * Words for the group review desk (C28, reviewed in A01's spirit). Status words come from the views
 * (`statusLabel`, participant `statusLabel`) and GROUP_STATUS_LABELS. This file adds tones and a mirror of
 * GROUP_TRANSITIONS from `convex/model/atelier/groups.ts` (a server module client code must not import),
 * listed under backendGaps so the lead can move it beside the other transitions.
 */

export const GROUPS_TITLE = "Group commissions";
export const GROUPS_DESCRIPTION =
  "Groups an organizer has sent for review, or the house has approved. Read the brief and the shared design, see who has joined and what each person has consented to share, then write the house's note; the organizer reads it on their group page.";

export const GROUP_STATUS_TONES: Record<GroupStatus, StatusTone> = {
  draft: "neutral",
  inviting: "neutral",
  in_review: "warning",
  approved: "success",
  closed: "neutral",
};

export const PARTICIPANT_STATUS_TONES: Record<ParticipantStatus, StatusTone> = {
  invited: "neutral",
  joined: "neutral",
  design_ready: "success",
  fit_ready: "success",
  ordered: "success",
  declined: "neutral",
};

export { GROUP_TRANSITIONS };

/** The outcomes `groups.review` accepts (vGroupReviewStatus), in the order the desk offers them. */
export const REVIEW_STATUSES: readonly GroupReviewStatus[] = ["approved", "in_review", "closed"];

export const REVIEW_STATUS_EFFECT: Record<GroupReviewStatus, string> = {
  approved:
    "The organizer reads that the house has approved the brief, with your note on their group page; invitations stop and participants finish their designs.",
  in_review:
    "Keeps or returns the group to review; the organizer reads your note on their group page as the house's question.",
  closed:
    "Closes the group; the organizer reads your note on their group page. Participants keep their own designs and any commission already placed.",
};

/** What a reviewing concierge may set from the group's current status. */
export function reviewOptionsFor(status: GroupStatus): GroupReviewStatus[] {
  return REVIEW_STATUSES.filter((candidate) => GROUP_TRANSITIONS[status].includes(candidate));
}

export function organizerReads(status: GroupReviewStatus): string {
  return GROUP_STATUS_LABELS[status];
}
