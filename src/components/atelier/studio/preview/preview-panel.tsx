"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { PreviewJobView, StartPreviewResult } from "@convex/atelier/previews";
import { StatusLine, type StatusTone } from "@/components/atelier/common/status-line";
import { useStudio } from "@/components/atelier/studio/panel-contract";
import { Button } from "@/components/ui/button";
import { usePersonPhoto } from "@/hooks/atelier/use-person-photo";
import { reportError, toClientError, type ClientError } from "@/lib/errors";
import { CompareLooks } from "./compare-looks";
import { ConsentIntro } from "./consent-intro";
import { BlockerNote, JobStatus, StartFailure, StartPreview, type StartBlocker } from "./job-status";
import { PhotoControls } from "./photo-controls";
import { PhotoUpload } from "./photo-upload";
import { PreviewSkeleton } from "./preview-skeleton";
import { ResultControls, type ResultView } from "./result-controls";

type Notice = { tone: StatusTone; words: string };

/** Codes the panel renders as states in their own words; anything else is also toasted. */
const QUIET_CODES = new Set<string>([
  "PREVIEWS_UNAVAILABLE",
  "DAILY_CAP_REACHED",
  "RATE_LIMITED",
  "INVALID_INPUT",
  "INVALID_STATE",
]);

const CONTINUE_LABEL = "Continue with the studio illustration";

/**
 * The "See it on you" step (S10–S14; C08–C11). Consent, then one photograph, then one preview of the
 * design as it stands; the stage shows the result when there is one and the words always say which
 * design it shows. Uploading never starts a job, and nothing here edits the tailoring specification.
 */
export function PreviewPanel() {
  const { draft, draftId, ownerArgs, guestKeyArg, stage, goToStep } = useStudio();
  const person = usePersonPhoto();
  const jobs = useQuery(api.atelier.previews.listForDraft, { draftId, ...ownerArgs });
  const startMutation = useMutation(api.atelier.previews.start);
  const cancelMutation = useMutation(api.atelier.previews.cancel);
  const retryMutation = useMutation(api.atelier.previews.retry);

  /** null: the step as it stands. "intro"/"upload": adding a photograph, or replacing the current one. */
  const [flow, setFlow] = useState<"intro" | "upload" | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [starting, setStarting] = useState(false);
  const [startFailure, setStartFailure] = useState<ClientError | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showingOriginal, setShowingOriginal] = useState(false);

  const photo = person.photo;
  const setMode = stage.setMode;

  const current = useMemo<PreviewJobView | null>(() => {
    if (!jobs) return null;
    const pointedAt = draft.currentPreview ? jobs.find((job) => job.jobId === draft.currentPreview?.jobId) : undefined;
    return pointedAt ?? jobs[0] ?? null;
  }, [jobs, draft.currentPreview]);

  // A finished result takes the stage once, when it arrives; the client's own choice of view stands after that.
  const resultShownRef = useRef<Id<"atelierPreviewJobs"> | null>(null);
  const resultReady = current !== null && current.status === "done" && current.resultUrl !== null;
  useEffect(() => {
    if (!resultReady || !current || resultShownRef.current === current.jobId) return;
    resultShownRef.current = current.jobId;
    setMode("personal");
  }, [resultReady, current, setMode]);

  const continueWithStudio = useCallback(() => {
    setMode("studio");
    goToStep("fit");
  }, [setMode, goToStep]);

  const runStart = useCallback(async (run: () => Promise<StartPreviewResult>) => {
    setStarting(true);
    setStartFailure(null);
    setNotice(null);
    try {
      const result = await run();
      if (result.reused) {
        setNotice({
          tone: "neutral",
          words: "This design already has a preview with your photograph; it is shown here.",
        });
      }
    } catch (error) {
      const failure = toClientError(error);
      if (!QUIET_CODES.has(failure.code)) toast.error(failure.message);
      setStartFailure(failure);
    } finally {
      setStarting(false);
    }
  }, []);

  const handleStart = useCallback(
    () => runStart(() => startMutation({ draftId, ...guestKeyArg })),
    [runStart, startMutation, draftId, guestKeyArg],
  );
  const handleRetry = useCallback(
    (job: PreviewJobView) => runStart(() => retryMutation({ jobId: job.jobId, ...guestKeyArg })),
    [runStart, retryMutation, guestKeyArg],
  );

  async function handleCancel(job: PreviewJobView) {
    setCancelling(true);
    try {
      await cancelMutation({ jobId: job.jobId, ...guestKeyArg });
    } catch (error) {
      reportError(error);
    } finally {
      setCancelling(false);
    }
  }

  async function handleRemove(photoId: Id<"atelierPersonPhotos">) {
    await person.remove(photoId);
    setShowingOriginal(false);
    setStartFailure(null);
    setMode("studio");
    setNotice({
      tone: "neutral",
      words: "Your photograph and the previews made from it have been removed. Your design is unchanged.",
    });
  }

  async function handleSend(replacing: boolean) {
    const view = await person.send();
    if (!view) return;
    setFlow(null);
    setStartFailure(null);
    setNotice({
      tone: "success",
      words: replacing
        ? "New photograph added. The previous one and its previews are being deleted; your design is unchanged."
        : "Photograph added. Nothing has been made from it yet.",
    });
  }

  function leaveFlow() {
    person.clear();
    setFlow(null);
  }

  if (photo === undefined || jobs === undefined) return <PreviewSkeleton />;

  const noticeLine = notice ? (
    <StatusLine live tone={notice.tone} className="text-pretty">
      {notice.words}
    </StatusLine>
  ) : null;

  // No photograph yet: the introduction, then the upload after the explicit action.
  if (photo === null) {
    if (flow === "upload") {
      return (
        <PhotoUpload
          upload={person.upload}
          replacing={false}
          onChoose={(file) => void person.choose(file)}
          onSend={() => void handleSend(false)}
          onRetake={person.clear}
          onCancel={leaveFlow}
          onRejected={(message) => toast.error(message)}
        />
      );
    }
    return (
      <ConsentIntro
        notice={noticeLine}
        onAddPhotograph={() => {
          setNotice(null);
          setFlow("upload");
        }}
        onContinue={continueWithStudio}
        continueLabel={CONTINUE_LABEL}
      />
    );
  }

  if (photo.status !== "active") {
    return (
      <div className="space-y-4">
        <StatusLine live tone="warning">
          Deleting
        </StatusLine>
        <p className="max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground">
          Your previous photograph and the previews made from it are being deleted from the house&apos;s systems. This
          finishes in a moment. Your design stays exactly as it is.
        </p>
        <Button variant="ghost" className="min-h-11 rounded-sm" onClick={continueWithStudio}>
          {CONTINUE_LABEL}
        </Button>
      </div>
    );
  }

  // Replacing: the terms again, then the upload; the current photograph stays until the new one is accepted.
  if (flow === "intro") {
    return (
      <ConsentIntro
        replacing
        onAddPhotograph={() => setFlow("upload")}
        onContinue={() => setFlow(null)}
        continueLabel="Keep the current photograph"
      />
    );
  }
  if (flow === "upload") {
    return (
      <PhotoUpload
        upload={person.upload}
        replacing
        onChoose={(file) => void person.choose(file)}
        onSend={() => void handleSend(true)}
        onRetake={person.clear}
        onCancel={leaveFlow}
        onRejected={(message) => toast.error(message)}
      />
    );
  }

  const blocker = startBlocker();
  const working = current !== null && (current.status === "queued" || current.status === "processing");
  const view: ResultView = showingOriginal ? "original" : stage.mode === "personal" ? "personal" : "studio";

  function startBlocker(): StartBlocker | null {
    if (draft.status === "archived")
      return { reason: "This design has been archived. Duplicate it to work on it again." };
    if (!draft.spec.clothCode) {
      return {
        reason: "Choose a cloth first: the preview dresses you in it.",
        action: { label: "Choose a cloth", onClick: () => goToStep("cloth") },
      };
    }
    if (draft.cloth && draft.cloth.status === "withdrawn") {
      return {
        reason: "That cloth is no longer in the catalogue. Choose another before asking for a preview.",
        action: { label: "Choose a cloth", onClick: () => goToStep("cloth") },
      };
    }
    if (photo && !photo.consentCurrent) {
      return {
        reason:
          "The photo terms have changed since this photograph was added. Add it again under the current terms to make a new preview.",
        action: { label: "Replace photograph", onClick: () => setFlow("intro") },
      };
    }
    return null;
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="preview-title" className="space-y-5">
        <div className="space-y-2">
          <h2 id="preview-title" className="text-xl font-medium tracking-tight sm:text-2xl">
            {current ? "Your preview" : "Ready for a preview"}
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground">
            {current
              ? "One photograph, one design at a time. The words beside the image say exactly which design it shows."
              : "Your photograph is here. A preview dresses it in the design exactly as it stands when you ask."}
          </p>
        </div>
        {noticeLine}

        {current && working ? (
          <JobStatus job={current} cancelling={cancelling} onCancel={() => void handleCancel(current)} />
        ) : current ? (
          <div className="space-y-4">
            <ResultControls
              job={current}
              photo={photo}
              view={view}
              onView={(next) => {
                if (next === "original") {
                  setShowingOriginal(true);
                  return;
                }
                setShowingOriginal(false);
                setMode(next);
              }}
              onReview={() => goToStep("review")}
              onUpdate={() => void handleStart()}
              onRetry={() => void handleRetry(current)}
              onKeepStudio={() => {
                setShowingOriginal(false);
                setMode("studio");
              }}
              busy={starting || blocker !== null}
            />
            {blocker ? <BlockerNote blocker={blocker} /> : null}
            {startFailure ? (
              <StartFailure failure={startFailure} onRetry={() => void handleStart()} onContinue={continueWithStudio} />
            ) : null}
          </div>
        ) : (
          <StartPreview
            starting={starting}
            blocker={blocker}
            failure={startFailure}
            onStart={() => void handleStart()}
            onContinue={continueWithStudio}
          />
        )}
      </section>

      <CompareLooks jobs={jobs} currentJobId={current?.jobId ?? null} onUseDesign={null} usingJobId={null} />

      <PhotoControls
        photo={photo}
        disabled={starting || cancelling}
        onReplace={() => {
          setNotice(null);
          setFlow("intro");
        }}
        onRemove={() => handleRemove(photo.photoId)}
      />

      <div className="border-t border-foreground/15 pt-5">
        <Button variant="ghost" className="min-h-11 rounded-sm" onClick={continueWithStudio}>
          {CONTINUE_LABEL}
        </Button>
      </div>
    </div>
  );
}
