import type { StatusTone } from "@/components/atelier/common/status-line";
import {
  PREVIEW_STATUS_LABELS,
  PREVIEW_STATUSES,
  type PhotoStatus,
  type PreviewQuality,
  type PreviewStatus,
} from "@convex/shared/atelier/enums";

/**
 * Words for preview operations (A06, O06). Status, quality and photograph words come from the enums'
 * label maps (the client reads the same ones); this file adds tones, the filter list and how the desk
 * names an owner.
 */

export const PREVIEWS_TITLE = "Preview operations";
export const PREVIEWS_DESCRIPTION =
  "Every personal-preview job: who asked, which design revision, how it ended and what it cost. A client's result is their likeness: viewing one is recorded in the audit log under your name.";

export const PREVIEW_STATUS_TONES: Record<PreviewStatus, StatusTone> = {
  queued: "warning",
  processing: "warning",
  done: "success",
  failed: "destructive",
  cancelled: "neutral",
  expired: "neutral",
};

export const PREVIEW_QUALITY_TONES: Record<PreviewQuality, StatusTone> = {
  pending: "warning",
  accepted: "success",
  rejected: "neutral",
};

export const PHOTO_STATUS_TONES: Record<PhotoStatus, StatusTone> = {
  active: "neutral",
  pending_deletion: "warning",
  deleted: "neutral",
};

export const OWNER_KIND_WORDS: Record<"account" | "guest", string> = {
  account: "Account",
  guest: "Guest · this browser only",
};

export const PREVIEW_FILTERS = ["all", ...PREVIEW_STATUSES] as const;
export type PreviewFilter = (typeof PREVIEW_FILTERS)[number];

export function isPreviewFilter(value: string | null | undefined): value is PreviewFilter {
  return value !== null && value !== undefined && (PREVIEW_FILTERS as readonly string[]).includes(value);
}

export function previewFilterDescription(filter: PreviewFilter): string {
  if (filter === "all") return "The most recent jobs in every state, newest first.";
  return `Jobs the client reads as “${PREVIEW_STATUS_LABELS[filter]}”.`;
}
