"use client";

import { useMutation, useQuery } from "convex/react";
import { FileQuestionMark } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@convex/_generated/api";
import type { DraftView } from "@convex/atelier/drafts";
import type { PreviewJobView } from "@convex/atelier/previews";
import { isStudioStep, type StudioStep } from "@convex/shared/atelier/enums";
import type { Conflict } from "@convex/shared/atelier/spec";
import { useAtelierSession } from "@/components/atelier/shell/atelier-session";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { useStudioCatalogue } from "@/hooks/atelier/use-catalogue";
import { useDraft } from "@/hooks/atelier/use-draft";
import { useSpecEditor } from "@/hooks/atelier/use-spec-editor";
import type { ClientError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { ConflictDialog } from "./conflict-dialog";
import { StudioContext, type StageMode, type StageView, type StudioContextValue } from "./panel-contract";
import { StepPanelSkeleton, StudioSkeleton } from "./studio-skeleton";

/** What the core's own pieces (stage, save status, redirect) need beyond the panel contract. */
type StudioCoreValue = {
  previews: PreviewJobView[] | undefined;
  /** The preview the draft points at, else the newest finished one, as the stage shows it. */
  currentPreview: PreviewJobView | null;
  storageAvailable: boolean;
  lastFailure: ClientError | null;
  retrySave: (() => void) | null;
  discardFailedChange: (() => void) | null;
  /** Where `/atelier/design/[draftId]` lands: the step the design was left on (C12). */
  landingStep: StudioStep;
};

const StudioCoreContext = createContext<StudioCoreValue | null>(null);

export function useStudioCore(): StudioCoreValue {
  const context = useContext(StudioCoreContext);
  if (!context) throw new Error("useStudioCore must be used inside the studio provider.");
  return context;
}

/**
 * The step a design opens on: its stage, the bookmark the studio keeps as the client moves and the
 * one the drafts row promises ("Next: …"). The model sets it deliberately for a new or duplicated
 * draft, so a design is never sent back to a step it already settled.
 */
export function landingStepFor(draft: Pick<DraftView, "stage">): StudioStep {
  return draft.stage;
}

/**
 * Loads the design, the catalogue and this draft's previews, and provides the studio contract to the
 * frame and every step panel. Renders the skeleton until the draft is here and the "not here" state
 * when the server answers null (a malformed, unknown or foreign id, all alike).
 */
export function StudioProvider({ draftId, children }: { draftId: string; children: ReactNode }) {
  const state = useDraft(draftId);
  if (state.status === "loading") return <StudioSkeleton />;
  if (state.status === "missing") return <DraftMissing />;
  return <LoadedStudio draft={state.draft}>{children}</LoadedStudio>;
}

function LoadedStudio({ draft, children }: { draft: DraftView; children: ReactNode }) {
  const router = useRouter();
  const params = useParams<{ draftId: string; step?: string }>();
  const { guestKey, storageAvailable, rememberDraft } = useAtelierSession();
  const guestKeyArg = useMemo(() => (guestKey ? { guestKey } : {}), [guestKey]);
  const catalogue = useStudioCatalogue();
  const previews = useQuery(api.atelier.previews.listForDraft, { draftId: draft._id, ...guestKeyArg });
  const setStageMutation = useMutation(api.atelier.drafts.setStage);

  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const resolverRef = useRef<((accept: boolean) => void) | null>(null);
  const confirmConflicts = useCallback(
    (next: Conflict[]) =>
      new Promise<boolean>((resolve) => {
        resolverRef.current?.(false);
        resolverRef.current = resolve;
        setConflicts(next);
      }),
    [],
  );
  const decideConflicts = useCallback((accept: boolean) => {
    resolverRef.current?.(accept);
    resolverRef.current = null;
    setConflicts(null);
  }, []);
  useEffect(
    () => () => {
      // Leaving the studio with the dialog open is "keep my design".
      resolverRef.current?.(false);
      resolverRef.current = null;
    },
    [],
  );

  const { editor, lastFailure, retry, discard } = useSpecEditor({ draft, guestKeyArg, confirmConflicts });

  const landing = landingStepFor(draft);
  const step: StudioStep = params.step && isStudioStep(params.step) ? params.step : landing;

  const [mode, setMode] = useState<StageMode>("studio");
  const [view, setView] = useState<StageView>("front");

  // Bookmark the step the client is on; a failure here changes nothing they can see.
  const sentStageRef = useRef<StudioStep | null>(null);
  useEffect(() => {
    if (draft.status === "archived" || draft.stage === step || sentStageRef.current === step) return;
    sentStageRef.current = step;
    void setStageMutation({ draftId: draft._id, ...guestKeyArg, step }).catch(() => undefined);
  }, [draft._id, draft.stage, draft.status, guestKeyArg, setStageMutation, step]);

  // Every save bumps updatedAt, so the drafts page can list and resume this design (C12). The index
  // records where it is saved, so signed out the page can say "saved to an account" rather than "gone".
  useEffect(() => {
    rememberDraft({ draftId: draft._id, name: draft.name, updatedAt: draft.updatedAt, account: draft.ownedByAccount });
  }, [draft._id, draft.name, draft.updatedAt, draft.ownedByAccount, rememberDraft]);

  const goToStep = useCallback(
    (next: StudioStep) => router.push(routes.atelier.step(draft._id, next)),
    [router, draft._id],
  );

  const currentPreview = useMemo<PreviewJobView | null>(() => {
    if (!previews) return null;
    const newestFirst = [...previews].sort((a, b) => b.createdAt - a.createdAt);
    const pointedAt = draft.currentPreview
      ? newestFirst.find((job) => job.jobId === draft.currentPreview?.jobId)
      : undefined;
    return (
      pointedAt ?? newestFirst.find((job) => job.status === "done" && job.resultUrl !== null) ?? newestFirst[0] ?? null
    );
  }, [previews, draft.currentPreview]);

  const value = useMemo<StudioContextValue>(
    () => ({
      draftId: draft._id,
      draft,
      guestKeyArg,
      ownerArgs: guestKeyArg,
      catalogue,
      editor,
      step,
      goToStep,
      stage: { mode, setMode, view, setView },
    }),
    [draft, guestKeyArg, catalogue, editor, step, goToStep, mode, view],
  );

  const core = useMemo<StudioCoreValue>(
    () => ({
      previews,
      currentPreview,
      storageAvailable,
      lastFailure,
      retrySave: retry,
      discardFailedChange: discard,
      landingStep: landing,
    }),
    [previews, currentPreview, storageAvailable, lastFailure, retry, discard, landing],
  );

  return (
    <StudioContext value={value}>
      <StudioCoreContext value={core}>
        {children}
        <ConflictDialog conflicts={conflicts} onDecide={decideConflicts} />
      </StudioCoreContext>
    </StudioContext>
  );
}

/** `/atelier/design/[draftId]` lands on the step the design was left on, the one the drafts row names. */
export function StudioStepRedirect() {
  const router = useRouter();
  const params = useParams<{ draftId: string }>();
  const { landingStep: step } = useStudioCore();
  useEffect(() => {
    // Child effects run before the app router's own; a navigation dispatched in the same tick is dropped.
    const handle = window.setTimeout(() => router.replace(routes.atelier.step(params.draftId, step)), 0);
    return () => window.clearTimeout(handle);
  }, [router, params.draftId, step]);
  return <StepPanelSkeleton />;
}

/** The server answered null: a malformed, unknown or foreign id all read the same, by design. */
export function DraftMissing() {
  const pathname = usePathname();
  return (
    <div className="py-10 sm:py-16">
      <EmptyState
        icon={FileQuestionMark}
        className="rounded-none"
        title="This design is not here"
        description="It may belong to another browser or account, or the link is wrong. Your other designs are untouched."
        action={
          <div className="flex flex-col items-center gap-3">
            <Button className="min-h-11" nativeButton={false} render={<Link href={routes.atelier.drafts} />}>
              Your drafts
            </Button>
            <p className="text-sm text-muted-foreground">
              <Link
                href={`${routes.signIn}?redirect_url=${encodeURIComponent(pathname)}`}
                className="underline underline-offset-3 hover:text-foreground"
              >
                Sign in
              </Link>{" "}
              if you designed it on your account, or{" "}
              <Link href={routes.atelier.home} className="underline underline-offset-3 hover:text-foreground">
                start designing
              </Link>
              .
            </p>
          </div>
        }
      />
    </div>
  );
}
