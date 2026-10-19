import type { StatusTone } from "@/components/atelier/common/status-line";
import { CATALOGUE_TRANSITIONS } from "@convex/shared/atelier/transitions";
import type { CatalogueKind, CatalogueStatus } from "@convex/shared/atelier/enums";
import { SEASONS, type Season } from "@convex/shared/wardrobe";

/**
 * Words for the catalogue desk. The enums carry no label maps for catalogue kinds, statuses or seasons, so
 * they live here until the lead adds them; `CATALOGUE_TRANSITIONS` is the model's own state machine.
 */
export { CATALOGUE_TRANSITIONS, SEASONS };

export const CATALOGUE_TITLE = "Catalogue";
export const CATALOGUE_DESCRIPTION =
  "The cloths, buttons and linings the house offers. Every entry carries provenance and an owner; a shade is representative until a fitter confirms it; nothing reaches a client until it is approved and a version is published.";

export const CATALOGUE_KINDS_ORDER = ["cloth", "button", "lining"] as const satisfies readonly CatalogueKind[];

export function isCatalogueKind(value: string | null | undefined): value is CatalogueKind {
  return value !== null && value !== undefined && (CATALOGUE_KINDS_ORDER as readonly string[]).includes(value);
}

export const CATALOGUE_KIND_WORDS: Record<CatalogueKind, { plural: string; singular: string }> = {
  cloth: { plural: "Cloths", singular: "Cloth" },
  button: { plural: "Buttons", singular: "Button" },
  lining: { plural: "Linings", singular: "Lining" },
};

export const CATALOGUE_STATUS_WORDS: Record<CatalogueStatus, string> = {
  draft: "Draft · not shown to clients",
  approved: "Approved",
  withdrawn: "Withdrawn",
};

export const CATALOGUE_STATUS_TONES: Record<CatalogueStatus, StatusTone> = {
  draft: "neutral",
  approved: "success",
  withdrawn: "warning",
};

/** The action word for moving to a status; the row's status word stays `CATALOGUE_STATUS_WORDS`. */
export const CATALOGUE_ACTION_WORDS: Record<CatalogueStatus, string> = {
  draft: "Back to draft",
  approved: "Approve",
  withdrawn: "Withdraw",
};

export const SEASON_WORDS: Record<Season, string> = {
  spring: "Spring",
  summer: "Summer",
  autumn: "Autumn",
  winter: "Winter",
};
