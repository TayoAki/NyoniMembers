"use client";

import Link from "next/link";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { DescribedLinesBook } from "@/components/atelier/requests/described-lines";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { CaseView } from "@convex/atelier/cases";

/** S25: the design exactly as the house received it, frozen at submission, with its revision number. */
export function SubmittedDesign({ request }: { request: CaseView }) {
  const { revision, draftRevision, draftId } = request;
  if (!revision) return null;
  const movedOn = draftRevision !== null && draftRevision > revision.revision;
  return (
    <AtelierSection
      id="submitted-design"
      title={`Submitted design · revision ${revision.revision}`}
      description="The exact design the house received, frozen when you sent it. The codes in mono are what the cutter reads."
      actions={
        draftId ? (
          <Button
            variant="outline"
            className="h-11 rounded-none px-5"
            render={<Link href={routes.atelier.step(draftId, "review")} />}
            nativeButton={false}
          >
            Open the draft
          </Button>
        ) : undefined
      }
    >
      {movedOn ? (
        <p className="mb-4 max-w-2xl text-sm leading-relaxed text-warning">
          Your draft has moved on to revision {draftRevision}. This request, its proposals and its quote are about
          revision {revision.revision}.
        </p>
      ) : null}
      <DescribedLinesBook lines={revision.lines} aria-label={`Submitted design, revision ${revision.revision}`} />
      <p className="mt-3 text-xs text-muted-foreground">Submitted {formatDateTime(revision.createdAt)}.</p>
    </AtelierSection>
  );
}
