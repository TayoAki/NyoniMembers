"use client";

import { useQuery } from "convex/react";
import { PenLine } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorAlert } from "@/components/common/error-alert";
import { PageHeader } from "@/components/common/page-header";
import { DraftRow } from "@/components/atelier/drafts/draft-row";
import { DraftsSkeleton } from "@/components/atelier/drafts/drafts-skeleton";
import { LocalOnlyRow } from "@/components/atelier/drafts/local-only-row";
import { useStartDraft } from "@/components/atelier/entry/use-start-draft";
import { useAtelierSession } from "@/components/atelier/shell/atelier-session";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAtelierViewer } from "@/hooks/atelier/use-atelier-viewer";
import { useOwnerArgs } from "@/hooks/atelier/use-owner-args";
import { pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";

/**
 * S15: every design this browser or the account holds, merged with the browser's own index so a draft
 * the server no longer returns is named rather than silently dropped. Starting new never discards old work.
 */
export function DraftsPage() {
  const { ready, storageAvailable, draftIndex, rememberDraft, forgetDraft } = useAtelierSession();
  const viewer = useAtelierViewer();
  const drafts = useQuery(api.atelier.drafts.listMine, useOwnerArgs({}));
  const { start, pending, canStart, error, clearError } = useStartDraft();

  // The server is the authority on where a draft is saved: an entry linked to the account since this
  // browser last saw it is re-marked, so signed out it reads "saved to an account", never "gone".
  useEffect(() => {
    if (!drafts) return;
    for (const draft of drafts) {
      const entry = draftIndex.find((candidate) => candidate.draftId === draft._id);
      if (entry && entry.account !== draft.ownedByAccount) rememberDraft({ ...entry, account: draft.ownedByAccount });
    }
  }, [drafts, draftIndex, rememberDraft]);

  // Account drafts this browser remembers are listed by the server only once it holds the account's
  // token; until then they would wrongly read as out of reach.
  const viewerSettling = viewer.status === "loading" || (viewer.status === "signed_in" && !viewer.convexReady);
  const holdForViewer = viewerSettling && draftIndex.some((entry) => entry.account === true);
  if (!ready || drafts === undefined || holdForViewer) return <DraftsSkeleton />;

  const signedIn = viewer.status === "signed_in";
  const serverIds = new Set<string>(drafts.map((draft) => draft._id));
  const localOnly = draftIndex.filter((entry) => !serverIds.has(entry.draftId));
  const linkable = drafts.filter((draft) => draft.linkable);
  const starting = pending !== null;
  const empty = drafts.length === 0 && localOnly.length === 0;

  const startNew = (
    <Button
      className="h-11 rounded-none px-5"
      onClick={() => void start({}, "new")}
      disabled={!canStart || starting}
      aria-busy={starting}
    >
      {starting ? <Spinner data-icon="inline-start" aria-label="Starting a new design" /> : null}
      {starting ? "Starting…" : empty ? "Start designing" : "Start new"}
    </Button>
  );

  return (
    <div className="space-y-8 pt-6">
      <PageHeader
        title="Your drafts."
        description="Every design saved by this browser or to your account. Saving is not sending: nothing here reaches the house until you request a quote or a review."
        actions={empty ? undefined : startNew}
      />

      {error ? (
        <ErrorAlert
          title="Could not start a design"
          message={error.message}
          onRetry={() => {
            clearError();
            void start({}, "new");
          }}
        />
      ) : null}

      {!storageAvailable ? (
        <p className="border-y border-foreground/15 py-3 text-sm text-muted-foreground">
          This browser is not keeping drafts — download your design before you leave. Work saves to the house while this
          page is open, but this browser will not find it again.
        </p>
      ) : null}

      {linkable.length > 0 ? (
        <section
          aria-labelledby="link-prompt"
          className="flex flex-col gap-3 border-y border-foreground/15 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="space-y-1">
            <h2 id="link-prompt" className="text-sm font-medium">
              {pluralize(linkable.length, "design is", "designs are")} saved to this browser only.
            </h2>
            <p className="text-sm text-muted-foreground">
              Save them to your account so they follow you to another device, with their photographs, requests and
              fittings.
            </p>
          </div>
          <Button
            variant="outline"
            className="h-11 shrink-0 rounded-none px-5"
            render={<Link href={routes.atelier.link} />}
            nativeButton={false}
          >
            Save to my account
          </Button>
        </section>
      ) : null}

      {empty ? (
        <EmptyState
          icon={PenLine}
          title="No designs yet"
          description="Start one. It is saved to this browser as you go, and to your account once you sign in."
          action={startNew}
          className="rounded-none"
        />
      ) : (
        <ul className="divide-y divide-foreground/10 border-y border-foreground/15" aria-label="Your designs">
          {drafts.map((draft) => (
            <DraftRow key={draft._id} draft={draft} />
          ))}
          {localOnly.map((entry) => (
            <LocalOnlyRow
              key={entry.draftId}
              entry={entry}
              signedIn={signedIn}
              onForget={() => forgetDraft(entry.draftId)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
