import type { StatusTone } from "@/components/atelier/common/status-line";
import type { PhotoStatus, PrivacyStatus, PrivacyStepStatus } from "@convex/shared/atelier/enums";

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

export const DELETE_DESIGNS_WORDS =
  "Every design is archived and its shared links are revoked; designs not tied to a commission or a request to the house are then deleted. A design a commission was cut from, and a design you sent the house with a request, stay with those records so the house can make and service the suit.";

export const EXPORT_WORDS =
  "A file of your designs, requests, commissions and fit profiles in the house's export format — nothing of anyone else's. It is written as a recorded step and downloaded from this page.";

/** No privacy step deletes a fit profile; the words say what actually happens to one. */
export const FIT_RECORDS_SENTENCE =
  "Measurements are kept only on an account and read only by you and the fitter who reviews them. A profile a commission was cut from is kept with that commission so the house can make and service the suit; closing your account removes your access to the rest. To change a measurement, start a revision under Fit.";

export const CLOSE_ACCOUNT_WORDS = [
  "Your export is written first, so you keep a copy of your designs, requests, commissions and fit profiles.",
  "Your photograph and every preview made from it are deleted, and the preview provider is told.",
  "Your designs are archived and their shared links revoked; those not tied to a commission or a request are deleted.",
  "Sign-in is managed by the house's identity provider. A privacy staff member removes the account there and records it when the request completes.",
  "Your requests to the house and the record of this privacy request are kept as service and audit records.",
] as const;

export const CLOSE_CONFIRM_WORD = "CLOSE";

export const PROVIDER_WAIT_SENTENCE =
  "“Waiting on a provider” means the house has recorded your deletion with the preview provider and cannot confirm the provider's own deletion from here.";

export function scopeWords(signedIn: boolean): string {
  return signedIn ? "your account" : "this browser";
}
