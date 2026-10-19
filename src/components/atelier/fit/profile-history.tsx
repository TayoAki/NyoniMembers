"use client";

import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { PROFILE_TONES } from "@/components/atelier/fit/fit-words";
import { LoadingRows } from "@/components/common/loading-grid";
import { formatDate } from "@/lib/format";
import type { Id } from "@convex/_generated/dataModel";
import type { FitProfileView } from "@convex/atelier/fit";

/** Every version the account has held, newest first, read-only (C16: values, revisions and reviewer stay traceable). */
export function ProfileHistory({
  entries,
  currentId,
}: {
  entries: FitProfileView[] | undefined;
  currentId: Id<"atelierFitProfiles">;
}) {
  if (entries === undefined) return <LoadingRows count={2} />;
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">No earlier versions.</p>;

  return (
    <ol className="divide-y divide-foreground/10 border-y border-foreground/15" aria-label="Profile versions">
      {entries.map((entry) => (
        <li
          key={entry._id}
          className="grid gap-2 py-3 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-baseline sm:gap-6"
        >
          <span className="flex items-baseline gap-2">
            <Mono upper={false} className="text-foreground">
              v{entry.version}
            </Mono>
            {entry._id === currentId ? <Mono className="text-primary">Current</Mono> : null}
          </span>
          <div className="min-w-0 space-y-1">
            <StatusLine tone={PROFILE_TONES[entry.status]}>{entry.statusLabel}</StatusLine>
            <p className="text-xs text-muted-foreground">
              {entry.provenanceLabel}
              {entry.reviewer ? ` · reviewed by ${entry.reviewer}` : ""}
              {entry.reviewNote ? ` · “${entry.reviewNote}”` : ""}
            </p>
          </div>
          <span className="text-xs text-muted-foreground sm:text-right">
            {entry.reviewedAt ? `Reviewed ${formatDate(entry.reviewedAt)}` : `Submitted ${formatDate(entry.createdAt)}`}
          </span>
        </li>
      ))}
    </ol>
  );
}
