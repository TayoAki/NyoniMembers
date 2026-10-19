"use client";

import Link from "next/link";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { DELETE_DESIGNS_WORDS, RECORDED_STEPS_SENTENCE, scopeWords } from "@/components/atelier/privacy/privacy-words";
import type { UsePrivacyRequest } from "@/components/atelier/privacy/use-privacy-request";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { DraftSummary } from "@convex/atelier/drafts";

type Props = {
  drafts: DraftSummary[];
  signedIn: boolean;
  privacy: UsePrivacyRequest;
};

/**
 * S34 · Designs (C27): how many designs this browser or account holds, and their deletion as a recorded
 * request — with the exception for designs tied to a commission or a request said before anything runs.
 */
export function DesignsSection({ drafts, signedIn, privacy }: Props) {
  const live = drafts.filter((draft) => draft.status !== "archived").length;
  const archived = drafts.length - live;
  const failure = privacy.failure?.kind === "delete_designs" ? privacy.failure.error : null;
  const nothing = drafts.length === 0;

  return (
    <AtelierSection
      id="designs"
      title="Designs"
      description="A design is a specification, not a photograph: cloth, cut and details. Deleting designs never touches a commission the house is making or has made."
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed">
          {nothing ? (
            <>No designs are saved to {scopeWords(signedIn)}.</>
          ) : (
            <>
              {pluralize(live, "design")} saved to {scopeWords(signedIn)}
              {archived > 0 ? `, and ${pluralize(archived, "archived design")}` : ""}.
            </>
          )}{" "}
          <Link href={routes.atelier.drafts} className="underline underline-offset-4 hover:text-muted-foreground">
            Your drafts
          </Link>
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <ConfirmDialog
            trigger={
              <Button variant="destructive" className="h-11 rounded-none px-5" disabled={nothing}>
                Delete my designs
              </Button>
            }
            title="Delete your designs?"
            description={`${DELETE_DESIGNS_WORDS} ${RECORDED_STEPS_SENTENCE}`}
            confirmLabel="Delete my designs"
            destructive
            onConfirm={() => privacy.submit("delete_designs")}
          />
          {nothing ? <span className="text-xs text-muted-foreground">There is nothing to delete.</span> : null}
        </div>
        <p className="max-w-2xl text-xs leading-relaxed text-pretty text-muted-foreground">{DELETE_DESIGNS_WORDS}</p>
        {failure ? (
          <ErrorAlert
            title="Could not open the deletion request"
            message={failure.message}
            onRetry={privacy.clearFailure}
            retryLabel="Dismiss"
          />
        ) : null}
      </div>
    </AtelierSection>
  );
}
