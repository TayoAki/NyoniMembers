"use client";

import { useMutation } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { savedScopeWords } from "@/components/atelier/drafts/draft-words";
import { RenameDialog } from "@/components/atelier/drafts/rename-dialog";
import { ShadeChip } from "@/components/atelier/entry/shade-chip";
import { useAtelierSession } from "@/components/atelier/shell/atelier-session";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useGuestKeyArg } from "@/hooks/atelier/use-owner-args";
import { reportError } from "@/lib/errors";
import { formatRelative } from "@/lib/format";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { DraftSummary } from "@convex/atelier/drafts";
import { DRAFT_STATUS_LABELS, OCCASION_LABELS, STEP_LABELS } from "@convex/shared/atelier/enums";

/** One design in the drafts list: what it is, where it is saved, and the four things you can do with it. */
export function DraftRow({ draft }: { draft: DraftSummary }) {
  const router = useRouter();
  const guestKeyArg = useGuestKeyArg();
  const { rememberDraft, forgetDraft } = useAtelierSession();
  const archive = useMutation(api.atelier.drafts.archive);
  const duplicate = useMutation(api.atelier.drafts.duplicate);
  const [renaming, setRenaming] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  const submitted = draft.status === "submitted";
  const clothWarning = draft.cloth && (draft.cloth.status === "withdrawn" || !draft.cloth.inStock);

  async function onDuplicate() {
    setDuplicating(true);
    try {
      const newId = await duplicate({ ...guestKeyArg, draftId: draft._id });
      rememberDraft({ draftId: newId, name: `${draft.name} (again)`, updatedAt: Date.now() });
      router.push(routes.atelier.design(newId));
    } catch (error) {
      reportError(error, "Could not duplicate the design.");
      setDuplicating(false);
    }
  }

  async function onArchive() {
    await archive({ ...guestKeyArg, draftId: draft._id });
    forgetDraft(draft._id);
  }

  return (
    <li className="grid gap-4 py-5 lg:grid-cols-[1fr_auto] lg:items-start lg:gap-8">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <ShadeChip hex={draft.cloth?.hex ?? null} />
          <h2 className="text-base font-medium">{draft.name}</h2>
          {submitted ? <StatusLine tone="gold">{DRAFT_STATUS_LABELS.submitted}</StatusLine> : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {draft.summary}
          {draft.cloth && !draft.cloth.shadeConfirmed ? <span className="text-xs"> · representative shade</span> : null}
        </p>
        {clothWarning ? (
          <StatusLine tone="warning">
            {draft.cloth?.status === "withdrawn"
              ? "Its cloth has been withdrawn — the review step asks you to choose again"
              : "Its cloth is not in stock — ask your concierge"}
          </StatusLine>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <StatusLine tone={draft.ownedByAccount ? "gold" : "neutral"}>
            {savedScopeWords(draft.ownedByAccount)}
          </StatusLine>
          <span className="text-xs text-muted-foreground">Updated {formatRelative(draft.updatedAt).toLowerCase()}</span>
          <span className="text-xs text-muted-foreground">
            {submitted ? "Sent for review" : `Next: ${STEP_LABELS[draft.stage]}`}
            {draft.occasion ? ` · ${OCCASION_LABELS[draft.occasion]}` : ""}
          </span>
          <Mono>Rev {draft.revision}</Mono>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <Button
          className="h-11 rounded-none px-5"
          render={<Link href={routes.atelier.step(draft._id, draft.stage)} />}
          nativeButton={false}
        >
          {submitted ? "Open" : "Resume"}
        </Button>
        {!submitted ? (
          <Button variant="ghost" className="h-11 rounded-none px-3" onClick={() => setRenaming(true)}>
            Rename
          </Button>
        ) : null}
        <Button
          variant="ghost"
          className="h-11 rounded-none px-3"
          onClick={onDuplicate}
          disabled={duplicating}
          aria-busy={duplicating}
        >
          {duplicating ? <Spinner data-icon="inline-start" aria-label="Duplicating" /> : null}
          {duplicating ? "Duplicating…" : "Duplicate"}
        </Button>
        {!submitted ? (
          <ConfirmDialog
            trigger={
              <Button variant="ghost" className="h-11 rounded-none px-3 text-muted-foreground hover:text-foreground">
                Archive
              </Button>
            }
            title={`Archive “${draft.name}”?`}
            description="It leaves your drafts. Nothing is deleted: the design stays on record with the house, and a duplicate can bring it back."
            confirmLabel="Archive"
            onConfirm={onArchive}
          />
        ) : null}
      </div>

      <RenameDialog
        key={`${draft._id}-${draft.name}`}
        draftId={draft._id}
        name={draft.name}
        open={renaming}
        onOpenChange={setRenaming}
      />
    </li>
  );
}
