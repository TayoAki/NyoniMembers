"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import type { PreviewJobView } from "@convex/atelier/previews";
import { validateSpec } from "@convex/shared/atelier/spec";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { useStudio } from "@/components/atelier/studio/panel-contract";
import { routes } from "@/lib/routes";
import { ExportActions } from "./export-actions";
import { RequestForm } from "./request-form";
import { ReviewEligibility } from "./review-eligibility";
import { ReviewOrderBook } from "./review-sections";
import {
  BLOCKING_WARNINGS,
  ReviewBlockers,
  ReviewWarnings,
  blockerForError,
  warningKey,
  type Blocker,
} from "./review-warnings";

/**
 * The review step (S24, C19): the whole design as the house will read it, what still needs attention,
 * the membership as recorded, the request, and the record to keep. Edits go back to their step; the
 * request is sent once per form and lands on its receipt (S25, built by the requests cluster).
 */
export function ReviewPanel() {
  const { draft, draftId, ownerArgs, guestKeyArg, goToStep } = useStudio();
  const previews = useQuery(api.atelier.previews.listForDraft, { draftId, ...ownerArgs });
  const [now] = useState(() => Date.now());
  const [acknowledged, setAcknowledged] = useState<ReadonlySet<string>>(() => new Set<string>());

  const preview = useMemo<PreviewJobView | null | undefined>(() => {
    if (previews === undefined) return undefined;
    const pointedAt = draft.currentPreview;
    if (!pointedAt) return null;
    return previews.find((job) => job.jobId === pointedAt.jobId) ?? null;
  }, [previews, draft.currentPreview]);

  const locked = draft.status !== "draft";
  const archived = draft.status === "archived";

  const blockers: Blocker[] = [
    ...validateSpec(draft.spec).map(blockerForError),
    ...draft.warnings
      .filter((warning) => BLOCKING_WARNINGS.includes(warning.code))
      .map<Blocker>((warning) => ({ message: warning.message, step: "cloth", actionLabel: "Choose another cloth" })),
  ];
  const readable = draft.warnings.filter((warning) => !BLOCKING_WARNINGS.includes(warning.code));
  const unread = readable.filter((warning) => !acknowledged.has(warningKey(warning)));

  const holds: string[] = [];
  if (archived) holds.push("Duplicate this archived design; an archived design is not sent to the house.");
  for (const blocker of blockers) holds.push(blocker.message);
  if (unread.length > 0) {
    holds.push(
      unread.length === 1
        ? "The note above is read and ticked."
        : `The ${unread.length} notes above are read and ticked.`,
    );
  }

  const acknowledge = (key: string, read: boolean) =>
    setAcknowledged((current) => {
      const next = new Set(current);
      if (read) next.add(key);
      else next.delete(key);
      return next;
    });

  return (
    <div className="space-y-8">
      <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
        Everything the house will read, in the words it will read them. Each section opens its step;
        {locked
          ? " this design has left the studio, so its lines stand as they were sent."
          : " nothing is sent until you ask."}
        {locked && !archived ? (
          <>
            {" "}
            <Link href={routes.atelier.requests} className="underline underline-offset-4 hover:text-foreground">
              Your requests
            </Link>
          </>
        ) : null}
      </p>

      <ReviewBlockers blockers={blockers} onGoToStep={goToStep} />
      <ReviewWarnings
        warnings={readable}
        acknowledged={acknowledged}
        onAcknowledge={acknowledge}
        onGoToStep={goToStep}
        disabled={archived}
      />

      <ReviewOrderBook draft={draft} preview={preview} now={now} onEdit={locked ? null : goToStep} />

      <AtelierSection
        id="review-membership"
        level={3}
        title="Your membership"
        description="The annual suit, as the house records it. Nothing here is assumed from the screen."
      >
        <ReviewEligibility />
      </AtelierSection>

      <AtelierSection
        id="review-request"
        level={3}
        title="Ask the house"
        description="Your design goes to a concierge exactly as it reads above. A request is received, not booked."
      >
        <RequestForm
          draftId={draftId}
          guestKeyArg={guestKeyArg}
          holds={holds}
          alreadySubmitted={draft.status === "submitted"}
        />
      </AtelierSection>

      <AtelierSection
        id="review-record"
        level={3}
        title="Keep a record"
        description="Download or print the design as it stands, whether or not you send it."
      >
        <ExportActions />
      </AtelierSection>
    </div>
  );
}
