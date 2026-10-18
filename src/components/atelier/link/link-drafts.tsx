"use client";

import { useMutation, useQuery } from "convex/react";
import { Link2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorAlert } from "@/components/common/error-alert";
import { PageHeader } from "@/components/common/page-header";
import { StatusLine } from "@/components/atelier/common/status-line";
import { savedScopeWords } from "@/components/atelier/drafts/draft-words";
import { ShadeChip } from "@/components/atelier/entry/shade-chip";
import { LinkSkeleton } from "@/components/atelier/link/link-skeleton";
import { useAtelierSession } from "@/components/atelier/shell/atelier-session";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAtelierViewer } from "@/hooks/atelier/use-atelier-viewer";
import { useOwnerArgs } from "@/hooks/atelier/use-owner-args";
import { toClientError, type ClientError } from "@/lib/errors";
import { formatRelative, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

const WHAT_MOVES =
  "A design you save to your account moves with everything tied to it: its photographs and previews, requests, fittings and share links. Nothing is copied; the browser's key to it is simply replaced by your account.";

/**
 * S16: after signing in, the guest designs this browser still holds are offered one by one. Saving is
 * explicit; "Keep separate" leaves a design with the browser for now, and the choice can be made again later.
 */
export function LinkDrafts() {
  const { status, convexReady } = useAtelierViewer();
  const { ready, guestKey } = useAtelierSession();
  const drafts = useQuery(api.atelier.drafts.listMine, useOwnerArgs({}, status === "signed_in"));
  const link = useMutation(api.atelier.drafts.link);
  const [kept, setKept] = useState<ReadonlySet<Id<"atelierDrafts">>>(new Set());
  const [linking, setLinking] = useState<Id<"atelierDrafts"> | null>(null);
  const [error, setError] = useState<ClientError | null>(null);

  if (status === "loading" || !ready) return <LinkSkeleton />;

  if (status === "signed_out") {
    return (
      <div className="space-y-8 pt-6">
        <PageHeader
          title="Save your designs to your account."
          description="Designs made as a guest live in this browser. Once you sign in, this page offers each one so it can follow you to another device."
        />
        <p className="max-w-2xl border-y border-foreground/15 py-4 text-sm leading-relaxed text-muted-foreground">
          {WHAT_MOVES}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            className="h-11 rounded-none px-5"
            render={<Link href={`${routes.signIn}?redirect_url=${encodeURIComponent(routes.atelier.link)}`} />}
            nativeButton={false}
          >
            Sign in to save them
          </Button>
          <Link
            href={routes.atelier.drafts}
            className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4 hover:text-muted-foreground"
          >
            Back to your drafts
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          Your designs stay in this browser in the meantime; signing in does not move anything on its own.
        </p>
      </div>
    );
  }

  if (drafts === undefined) return <LinkSkeleton />;

  const offered = drafts.filter((draft) => draft.linkable && !kept.has(draft._id));
  const owned = drafts.filter((draft) => draft.ownedByAccount).length;

  async function save(draftId: Id<"atelierDrafts">) {
    if (!guestKey) {
      setError({
        code: "INVALID_INPUT",
        message: "This browser's key for the design is missing, so it cannot be saved from here.",
      });
      return;
    }
    setLinking(draftId);
    setError(null);
    try {
      await link({ draftId, guestKey });
      toast.success("Saved to your account");
    } catch (caught) {
      setError(toClientError(caught));
    } finally {
      setLinking(null);
    }
  }

  return (
    <div className="space-y-8 pt-6">
      <PageHeader
        title="Save your designs to your account."
        description={
          owned > 0
            ? `${pluralize(owned, "design is", "designs are")} already in your account. The designs below were made in this browser before you signed in.`
            : "The designs below were made in this browser before you signed in."
        }
      />
      <p className="max-w-2xl border-y border-foreground/15 py-4 text-sm leading-relaxed text-muted-foreground">
        {WHAT_MOVES}
      </p>

      {error ? (
        <ErrorAlert
          title="Could not save the design to your account"
          message={
            error.code === "UNAUTHENTICATED" ? (
              <>
                {error.message}{" "}
                <Link
                  href={`${routes.signIn}?redirect_url=${encodeURIComponent(routes.atelier.link)}`}
                  className="underline underline-offset-4"
                >
                  Sign in
                </Link>
              </>
            ) : (
              error.message
            )
          }
        />
      ) : null}

      {!convexReady ? <StatusLine live>Confirming your account…</StatusLine> : null}

      {offered.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="Nothing left to save"
          description={
            kept.size > 0
              ? "The designs you chose to keep separate stay in this browser. Come back here any time to save them."
              : "Every design in this browser is already in your account, or there are none here."
          }
          action={
            <Button
              className="h-11 rounded-none px-5"
              render={<Link href={routes.atelier.drafts} />}
              nativeButton={false}
            >
              Go to your drafts
            </Button>
          }
          className="rounded-none"
        />
      ) : (
        <ul
          className="divide-y divide-foreground/10 border-y border-foreground/15"
          aria-label="Designs saved to this browser"
        >
          {offered.map((draft) => {
            const busy = linking === draft._id;
            return (
              <li key={draft._id} className="grid gap-4 py-5 lg:grid-cols-[1fr_auto] lg:items-start lg:gap-8">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <ShadeChip hex={draft.cloth?.hex ?? null} />
                    <h2 className="text-base font-medium">{draft.name}</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">{draft.summary}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <StatusLine>{savedScopeWords(draft.ownedByAccount)}</StatusLine>
                    <span className="text-xs text-muted-foreground">
                      Updated {formatRelative(draft.updatedAt).toLowerCase()}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <Button
                    className="h-11 rounded-none px-5"
                    onClick={() => void save(draft._id)}
                    disabled={linking !== null || !convexReady}
                    aria-busy={busy}
                  >
                    {busy ? <Spinner data-icon="inline-start" aria-label="Saving to your account" /> : null}
                    {busy ? "Saving…" : "Save to my account"}
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-11 rounded-none px-3"
                    onClick={() => setKept((current) => new Set(current).add(draft._id))}
                    disabled={busy}
                  >
                    Keep separate
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
