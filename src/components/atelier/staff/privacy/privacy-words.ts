import type { StatusTone } from "@/components/atelier/common/status-line";
import { routes } from "@/lib/routes";
import type { PrivacyStatus, PrivacyStepStatus } from "@convex/shared/atelier/enums";

/**
 * Words for the privacy desk (A08, O08). Request and kind words come from the views (`statusLabel`,
 * `kindLabel`, step `label`); this file adds tones, the step-status words (the enums carry none: a
 * backend gap) and the audit table map.
 */

export const PRIVACY_TITLE = "Privacy";
export const PRIVACY_DESCRIPTION =
  "Export, deletion and closure requests as they really stand, step by step; who holds which role; and the audit log of what the house's people did. A failed step is retried or escalated, never hidden.";

export const PRIVACY_STATUS_TONES: Record<PrivacyStatus, StatusTone> = {
  requested: "warning",
  access_revoked: "warning",
  primary_deleted: "warning",
  downstream_pending: "warning",
  completed: "success",
  rejected: "neutral",
};

export const STEP_STATUS_WORDS: Record<PrivacyStepStatus, string> = {
  pending: "Pending",
  done: "Done",
  failed: "Failed · can be re-run",
  exception: "Kept · a disclosed exception",
};

export const STEP_STATUS_TONES: Record<PrivacyStepStatus, StatusTone> = {
  pending: "warning",
  done: "success",
  failed: "destructive",
  exception: "neutral",
};

export const OWNER_KIND_WORDS: Record<"account" | "guest", string> = {
  account: "Account",
  guest: "Guest · this browser only",
};

export const PRIVACY_TABS = ["requests", "roles", "audit"] as const;
export type PrivacyTab = (typeof PRIVACY_TABS)[number];
export const PRIVACY_TAB_LABELS: Record<PrivacyTab, string> = {
  requests: "Requests",
  roles: "Staff roles",
  audit: "Audit log",
};

export function isPrivacyTab(value: string | null | undefined): value is PrivacyTab {
  return value !== null && value !== undefined && (PRIVACY_TABS as readonly string[]).includes(value);
}

/** The tables the audit log names, with the desk page that opens a record where one exists. */
export const AUDIT_TABLES: readonly { table: string; words: string; href?: (id: string) => string }[] = [
  { table: "atelierCases", words: "Requests", href: routes.staffAtelier.case },
  { table: "atelierOrders", words: "Commissions", href: routes.staffAtelier.order },
  { table: "atelierCorrections", words: "Corrections", href: routes.staffAtelier.correction },
  { table: "atelierFitProfiles", words: "Fit profiles", href: routes.staffAtelier.fitProfile },
  { table: "atelierFitPhotos", words: "Fit photographs" },
  { table: "atelierPreviewJobs", words: "Preview jobs" },
  { table: "atelierPersonPhotos", words: "Client photographs" },
  { table: "atelierQuotes", words: "Quotes" },
  { table: "atelierAppointments", words: "Fittings" },
  { table: "atelierDrafts", words: "Designs" },
  { table: "atelierShares", words: "Shared links" },
  { table: "atelierGroups", words: "Group commissions" },
  { table: "atelierCatalogueEntries", words: "Catalogue entries" },
  { table: "atelierPrivacyRequests", words: "Privacy requests" },
  { table: "users", words: "Accounts" },
];

export function auditTarget(table: string, id: string): { words: string; href: string | null } {
  const known = AUDIT_TABLES.find((entry) => entry.table === table);
  return { words: known?.words ?? table, href: known?.href ? known.href(id) : null };
}

export const AUDIT_LIMITS = [50, 100, 200] as const;
