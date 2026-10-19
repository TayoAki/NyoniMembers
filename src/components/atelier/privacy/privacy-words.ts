import type { StatusTone } from "@/components/atelier/common/status-line";
import {
  PRIVACY_KIND_LABELS,
  PRIVACY_STATUS_LABELS,
  type PhotoStatus,
  type PrivacyStatus,
  type PrivacyStepStatus,
} from "@convex/shared/atelier/enums";

/** Colour never carries the meaning alone; the words from `PRIVACY_STATUS_LABELS` do. */
export const PRIVACY_TONES: Record<PrivacyStatus, StatusTone> = {
  requested: "neutral",
  access_revoked: "neutral",
  primary_deleted: "neutral",
  downstream_pending: "neutral",
  completed: "success",
  rejected: "warning",
};

export const PHOTO_TONES: Record<PhotoStatus, StatusTone> = {
  active: "neutral",
  pending_deletion: "warning",
  deleted: "neutral",
};

/** The words beside each step are `PRIVACY_STEP_STATUS_LABELS`, the same ones staff read; only the tone lives here. */
export const STEP_TONES: Record<PrivacyStepStatus, StatusTone> = {
  pending: "neutral",
  done: "success",
  failed: "warning",
  exception: "warning",
};

/** The same words the studio's photo controls use, so the two places never disagree. */
export const REMOVE_PHOTO_WORDS =
  "This deletes the photograph and every preview made from it from the house's systems, now. A preview still being made is cancelled. Your design stays exactly as it is.";

export const PENDING_DELETION_WORDS =
  "The photograph and every preview made from it are being deleted from the house's systems. Nothing is called deleted before it is.";

export const RECORDED_STEPS_SENTENCE =
  "Each step is recorded below as it completes, and nothing is called deleted before it is.";

/** What the house sends the preview provider on a deletion: nothing, and the words say so (PHOTO_CONSENT). */
export const PROVIDER_RETENTION_SENTENCE =
  "The preview provider holds what was sent to it under its own retention terms; the house sends it no deletion request and cannot confirm its deletion.";

export const PHOTO_REQUEST_WORDS = `“${PRIVACY_KIND_LABELS.delete_photos}” runs the removal as recorded steps: preview links revoked, preview jobs cancelled, your photograph, its previews and the posture photographs on your fit profiles deleted. ${PROVIDER_RETENTION_SENTENCE}`;

export const DELETE_DESIGNS_WORDS =
  "Every shared link to your designs is revoked, and designs not tied to a commission or a request to the house are archived, then deleted. A design a commission was cut from stays with that commission so the house can make and service the suit, and a design you sent the house with a request stays with that request; both stay as they are, with their shared links revoked.";

export const EXPORT_WORDS =
  "A file of your designs, requests, commissions and fit profiles in the house's export format — nothing of anyone else's. It is written as a recorded step and downloaded from this page.";

/** No privacy step deletes a fit profile's measurements; the words say what actually happens to one. */
export const FIT_RECORDS_SENTENCE =
  "Measurements are kept only on an account and read only by you and the fitter who reviews them. Posture photographs you added for a fitter can be removed one at a time under Fit, and are all deleted when you remove your photos or close your account; the measurements stay. A profile a commission was cut from is kept with that commission so the house can make and service the suit; closing your account removes your access to the rest. To change a measurement, start a revision under Fit.";

export const CLOSE_ACCOUNT_WORDS = [
  "Your export is written first, so you keep a copy of your designs, requests, commissions and fit profiles.",
  `Your photograph, every preview made from it and the posture photographs on your fit profiles are deleted. ${PROVIDER_RETENTION_SENTENCE}`,
  "Every shared link to your designs is revoked, and designs not tied to a commission or a request are deleted; those that are stay as they are with that record.",
  `Sign-in is managed by the house's identity provider. A privacy staff member removes the account there and records it here; until then the request reads “${PRIVACY_STATUS_LABELS.downstream_pending}”.`,
  "Your requests to the house, your fit profiles' measurements and the record of this privacy request are kept as service and audit records.",
] as const;

export const CLOSE_CONFIRM_WORD = "CLOSE";

export const PROVIDER_WAIT_SENTENCE = `“${PRIVACY_STATUS_LABELS.downstream_pending}” means what remains rests outside the house's systems: the removal of your sign-in at the identity provider, which a privacy staff member records here.`;

/** A request made while signed in covers the account; designs this browser holds unlinked are its own. */
export function browserOnlyWords(count: number): string {
  return `${count === 1 ? "1 more design is" : `${count} more designs are`} saved only to this browser, not to your account, and a request made here while signed in does not cover ${count === 1 ? "it" : "them"} or any photograph this browser holds. Link ${count === 1 ? "it" : "them"} to your account first, or sign out and remove ${count === 1 ? "it" : "them"} from this browser.`;
}

export function scopeWords(signedIn: boolean): string {
  return signedIn ? "your account" : "this browser";
}
