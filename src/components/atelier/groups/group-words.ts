import { format } from "date-fns";
import type { StatusTone } from "@/components/atelier/common/status-line";
import type { GroupParticipantView, PermittedIndividualPath } from "@convex/atelier/groups";
import type { GroupStatus, ParticipantStatus } from "@convex/shared/atelier/enums";

/** Colour never carries the meaning alone; gold marks the states that wait on the organizer. */
export const GROUP_TONES: Record<GroupStatus, StatusTone> = {
  draft: "neutral",
  inviting: "gold",
  in_review: "neutral",
  approved: "success",
  closed: "neutral",
};

export const PARTICIPANT_TONES: Record<ParticipantStatus, StatusTone> = {
  invited: "neutral",
  joined: "neutral",
  design_ready: "gold",
  fit_ready: "gold",
  ordered: "success",
  declined: "neutral",
};

/** One sentence on what the group's status means for the organizer, true for the status as it stands. */
export const GROUP_STATUS_SENTENCES: Record<GroupStatus, string> = {
  draft: "Invite the first participant to open the group. The brief and the shared design can still change.",
  inviting:
    "Invitations are open. Each person joins by the link you pass on, designs privately and is fitted privately; ask your concierge when the group is ready for the house to review.",
  in_review:
    "The house is reviewing the shared design and everyone's readiness. You can still edit the brief; the shared design and the permitted details are what is being reviewed, so they stay as they are.",
  approved: "Approved by the house. Invitations are closed here — ask your concierge to add anyone else.",
  closed: "Closed by the house. Nothing further changes on this group; each participant keeps their own design.",
};

/**
 * Mirrors `PERMITTED_INDIVIDUAL_PATHS` in convex/model/atelier/groups.ts, a server-only module the
 * client cannot import. The Record type fails to compile the moment that list changes, and the order
 * here is the list's order.
 */
export const PERMITTED_LABELS: Record<PermittedIndividualPath, { label: string; description: string }> = {
  "jacket.vents": { label: "Vents", description: "None, a single vent or a double vent at the back of the jacket." },
  "jacket.pockets": { label: "Pockets", description: "Flap, jetted or patch." },
  "jacket.ticketPocket": { label: "Ticket pocket", description: "A small third pocket above the right hip." },
  "jacket.sleeveButtons": { label: "Sleeve buttons", description: "Four or five at each cuff." },
  "jacket.workingCuffs": { label: "Working cuffs", description: "Buttonholes that open." },
  "trousers.pleats": { label: "Trouser front", description: "Flat front, a single pleat or a double pleat." },
  "trousers.hem": { label: "Hem", description: "Plain or cuffed." },
  "trousers.waistband": { label: "Waistband", description: "Belt loops or side adjusters." },
  "trousers.fit": { label: "Trouser fit", description: "Classic, tailored or slim through the leg." },
  monogram: { label: "Monogram", description: "Initials, their placement, thread and lettering." },
  liningCode: { label: "Lining", description: "A lining from the house's range." },
};

export const PERMITTED_PATHS = Object.keys(PERMITTED_LABELS) as PermittedIndividualPath[];

export function permittedLabel(path: PermittedIndividualPath): string {
  return PERMITTED_LABELS[path].label;
}

export const ORGANIZER_ISOLATION =
  "You see each participant's readiness only — never their measurements, photographs, contact details or the design they are making. Each person designs and is fitted privately with the house, and no one orders for anyone else.";

export const PARTICIPANT_ISOLATION =
  "The organizer sees only what you choose to share: whether your design is ready and whether a fitter has approved your fit. They never see your measurements, photographs, contact details or the design itself.";

export const INVITE_LINK_SENTENCE =
  "Pass this link on yourself — it is the invitation. When an email is given the house records a notification; that record is not proof of delivery.";

export const GROUP_REVIEW_SENTENCE =
  "The house reviews the group before anything is cut: the shared design, each person's readiness and the date. Matching cloth and cut is explicit; a shared fit is never promised.";

/** What the organizer may read of a participant's progress: shared status only, or the fact that it is not shared. */
export function designWords(participant: Pick<GroupParticipantView, "consent" | "designReady" | "status">): string {
  if (participant.status === "invited" || participant.status === "declined") return "—";
  if (!participant.consent.shareStyleStatus) return "Not shared";
  return participant.designReady ? "Design ready" : "Design not yet ready";
}

export function fitWords(participant: Pick<GroupParticipantView, "consent" | "fitReady" | "status">): string {
  if (participant.status === "invited" || participant.status === "declined") return "—";
  if (!participant.consent.shareFitStatus) return "Not shared";
  return participant.fitReady ? "Fit approved by a fitter" : "Fit not yet approved";
}

const DATE_INPUT = "yyyy-MM-dd";

export function toDateInput(timestamp: number | undefined): string {
  return timestamp === undefined ? "" : format(timestamp, DATE_INPUT);
}

/** A date input's value as local noon, so the day the organizer typed is the day the house reads. */
export function fromDateInput(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const timestamp = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

/** Limits that live in convex/model/atelier/groups.ts (server-only); mirrored here for inline validation. */
export const GROUP_NAME_MAX = 80;
export const GROUP_BRIEF_MAX = 2000;
export const PARTICIPANT_NAME_MAX = 80;
