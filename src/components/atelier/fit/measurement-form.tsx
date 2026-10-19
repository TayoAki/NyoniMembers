"use client";

import { useMutation } from "convex/react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { ChoiceList, ChoiceRow } from "@/components/atelier/fit/choice-list";
import { POSE_LABELS, signInHref, type Viewer } from "@/components/atelier/fit/fit-words";
import { EMPTY_POSES, PosturePhotosField, type PoseFiles } from "@/components/atelier/fit/posture-photos-field";
import { UnitToggle } from "@/components/atelier/fit/unit-toggle";
import { useAtelierSession } from "@/components/atelier/shell/atelier-session";
import { ErrorAlert } from "@/components/common/error-alert";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  sheetFromProfile,
  SHEET_STORAGE_KEY,
  useMeasurementForm,
  type MeasurementFieldState,
} from "@/hooks/atelier/use-measurement-form";
import { reportError, toClientError, type ClientError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { FitProfileView } from "@convex/atelier/fit";
import { FIT_PHOTO_POSES, FIT_PROFILE_STATUS_LABELS, type FitPhotoPose } from "@convex/shared/atelier/enums";
import {
  JACKET_COMFORT,
  JACKET_COMFORT_LABELS,
  MEASUREMENT_FIELDS,
  MEASUREMENT_GROUP_LABELS,
  MOVEMENT_LABELS,
  MOVEMENT_OPTIONS,
  POSTURE_LABELS,
  POSTURE_OPTIONS,
  TROUSER_COMFORT,
  TROUSER_COMFORT_LABELS,
  type JacketComfort,
  type MeasurementField,
  type MeasurementGroup,
  type Posture,
  type TrouserComfort,
} from "@convex/shared/atelier/measurements";

const GROUPS = Object.keys(MEASUREMENT_GROUP_LABELS) as MeasurementGroup[];
const NO_POSTURE = "unsure";

type PhotoOutcome = { kind: "sending" } | { kind: "sent" } | { kind: "failed"; message: string };
type Phase =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "photos"; profileId: Id<"atelierFitProfiles"> }
  | { kind: "done"; profileId: Id<"atelierFitProfiles"> };

type Props = {
  viewer: Viewer;
  /** The version a revision starts from; null for a fresh sheet. */
  source: FitProfileView | null;
  /** Where sign-in returns to. */
  returnTo: string;
  onSubmitted: () => void;
  onCancelRevision: () => void;
};

/**
 * S21 (C17): the guided measurement sheet. Guests can read the guide and fill the sheet (it waits in
 * this browser); submitting needs an account. The sheet becomes a provisional version a fitter
 * reviews: the words after submit are "Submitted · awaiting review by a fitter", never approved.
 */
export function MeasurementForm({ viewer, source, returnTo, onSubmitted, onCancelRevision }: Props) {
  const ids = useId();
  const { storageAvailable } = useAtelierSession();
  const initial = useMemo(() => (source ? sheetFromProfile(source) : undefined), [source]);
  const form = useMeasurementForm({ initial, persistKey: source ? null : SHEET_STORAGE_KEY });
  const submitRemote = useMutation(api.atelier.fit.submitRemote);
  const startRevision = useMutation(api.atelier.fit.startRevision);
  const generateUploadUrl = useMutation(api.atelier.fit.generateFitPhotoUploadUrl);
  const registerPhoto = useMutation(api.atelier.fit.registerFitPhoto);

  const [photos, setPhotos] = useState<PoseFiles>(EMPTY_POSES);
  const [photoConsent, setPhotoConsent] = useState(false);
  const [photoOutcomes, setPhotoOutcomes] = useState<Partial<Record<FitPhotoPose, PhotoOutcome>>>({});
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [failure, setFailure] = useState<ClientError | null>(null);

  const signedIn = viewer.status === "signed_in";
  const pending = phase.kind === "submitting" || phase.kind === "photos";
  const chosenPhotos = FIT_PHOTO_POSES.filter((pose) => photos[pose] !== null);

  async function sendPhoto(profileId: Id<"atelierFitProfiles">, pose: FitPhotoPose, file: File) {
    setPhotoOutcomes((prev) => ({ ...prev, [pose]: { kind: "sending" } }));
    try {
      const url = await generateUploadUrl({});
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      if (!response.ok) throw new Error("The upload did not complete.");
      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
      await registerPhoto({ profileId, storageId, pose });
      setPhotoOutcomes((prev) => ({ ...prev, [pose]: { kind: "sent" } }));
    } catch (error) {
      setPhotoOutcomes((prev) => ({ ...prev, [pose]: { kind: "failed", message: toClientError(error).message } }));
    }
  }

  async function submit() {
    form.markAttempted();
    const submission = form.submission();
    if (!submission) {
      setFailure({
        code: "INVALID_INPUT",
        message: "Some of the sheet still needs attention; the fields are marked below.",
      });
      return;
    }
    setFailure(null);
    setPhase({ kind: "submitting" });
    try {
      const profileId = source
        ? await startRevision({
            fromProfileId: source._id,
            changes: {
              units: submission.units,
              measurements: submission.measurements,
              comfort: submission.comfort,
              posture: submission.posture ?? null,
              notes: submission.notes ?? null,
              uncertainFields: submission.uncertainFields,
            },
          })
        : await submitRemote(submission);
      if (chosenPhotos.length > 0 && photoConsent) {
        setPhase({ kind: "photos", profileId });
        for (const pose of chosenPhotos) {
          const file = photos[pose];
          if (file) await sendPhoto(profileId, pose, file);
        }
      }
      form.clearPersisted();
      setPhase({ kind: "done", profileId });
      toast.success(FIT_PROFILE_STATUS_LABELS.provisional);
    } catch (error) {
      setFailure(reportError(error, "The sheet was not submitted."));
      setPhase({ kind: "idle" });
    }
  }

  if (phase.kind === "done" || phase.kind === "photos") {
    return (
      <section aria-labelledby="fit-receipt" className="max-w-3xl space-y-5">
        <h2 id="fit-receipt" className="text-xl font-medium tracking-tight sm:text-2xl">
          {source ? `Revision of version ${source.version} sent` : "Your sheet is with the house"}
        </h2>
        <StatusLine tone="neutral" live className="text-sm">
          {phase.kind === "photos" ? "Submitted · sending your photographs…" : FIT_PROFILE_STATUS_LABELS.provisional}
        </StatusLine>
        <p className="max-w-2xl text-sm leading-relaxed text-pretty text-muted-foreground">
          A fitter reviews every value and either approves the profile or asks you a question first. Nothing is approved
          automatically, and no size is read from a photograph.
        </p>
        {chosenPhotos.length > 0 ? (
          <ul className="divide-y divide-foreground/10 border-y border-foreground/15 text-sm" aria-label="Photographs">
            {chosenPhotos.map((pose) => {
              const outcome = photoOutcomes[pose];
              return (
                <li key={pose} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <span>{POSE_LABELS[pose]} photograph</span>
                  {outcome?.kind === "sent" ? (
                    <StatusLine tone="success">Sent to your profile</StatusLine>
                  ) : outcome?.kind === "failed" ? (
                    <StatusLine tone="warning">Could not send — {outcome.message}</StatusLine>
                  ) : (
                    <StatusLine live>Sending…</StatusLine>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button className="h-11 rounded-none px-5" onClick={onSubmitted} disabled={phase.kind === "photos"}>
            See your profile
          </Button>
        </div>
      </section>
    );
  }

  return (
    <form
      className="max-w-3xl space-y-10"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {source ? (
        <Alert className="rounded-none">
          <AlertTitle>Revising version {source.version}</AlertTitle>
          <AlertDescription>
            {source.clarification ? <p>The fitter asked: “{source.clarification}”</p> : null}
            <p>
              The sheet starts from{" "}
              {source.approvedValues ? "the values the fitter approved" : "the values you submitted"}. Change what has
              changed and submit; version {source.version} is kept as it is.
            </p>
            <Button type="button" variant="ghost" size="sm" className="rounded-none px-2" onClick={onCancelRevision}>
              Cancel the revision
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {!signedIn ? (
        <Alert className="rounded-none">
          <AlertTitle>Sign in to save measurements</AlertTitle>
          <AlertDescription>
            <p>
              A fit profile belongs to an account so only you and your fitter can see it.{" "}
              {storageAvailable
                ? "You can fill in the sheet now; it waits in this browser until you sign in and submit it."
                : "This browser is not keeping what you type; sign in first so nothing is lost."}
            </p>
            <Link
              href={signInHref(returnTo)}
              className="inline-flex min-h-11 items-center font-medium underline underline-offset-4"
            >
              Sign in
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      {form.restored ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          Brought back the sheet you left in this browser.
          <Button type="button" variant="ghost" size="sm" className="h-9 rounded-none px-2" onClick={form.reset}>
            Start again
          </Button>
        </p>
      ) : null}

      <header className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <h2 className="text-xl font-medium tracking-tight sm:text-2xl">The measurement sheet</h2>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              A soft tape, snug but not tight, over a shirt and trousers that fit. Take each one twice.
            </p>
          </div>
          <UnitToggle unit={form.unit} onChange={form.setUnit} disabled={pending} />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <StatusLine tone={form.requiredEntered === form.requiredTotal ? "gold" : "neutral"} live>
            {form.requiredEntered} of {form.requiredTotal} required measurements entered
          </StatusLine>
          <span>
            <span className="text-primary" aria-hidden>
              *
            </span>{" "}
            Required for a fitter to approve the profile. Values are kept in centimetres and shown to the nearest 0.5 cm
            or quarter inch.
          </span>
        </div>
      </header>

      {GROUPS.map((group) => {
        const fields = MEASUREMENT_FIELDS.filter((field) => field.group === group);
        return (
          <section key={group} aria-labelledby={`${ids}-${group}`} className="space-y-3">
            <h3
              id={`${ids}-${group}`}
              className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase"
            >
              {MEASUREMENT_GROUP_LABELS[group]}
            </h3>
            <ol className="divide-y divide-foreground/10 border-y border-foreground/15">
              {fields.map((field) => (
                <MeasurementRow
                  key={field.key}
                  id={`${ids}-${field.key}`}
                  number={MEASUREMENT_FIELDS.indexOf(field) + 1}
                  field={field}
                  unit={form.unit}
                  state={form.fieldState(field)}
                  disabled={pending}
                  onChange={(raw) => form.setText(field.key, raw)}
                  onBlur={() => form.commit(field.key)}
                  onUncertain={(on) => form.setUncertain(field.key, on)}
                />
              ))}
            </ol>
          </section>
        );
      })}

      <FieldSet>
        <FieldLegend variant="label">
          How you like the jacket to sit{" "}
          <span className="text-primary" aria-hidden>
            *
          </span>
        </FieldLegend>
        <ChoiceList
          value={form.sheet.jacket ?? ""}
          onValueChange={(value) => form.setJacket(value as JacketComfort)}
          aria-label="Jacket comfort"
          disabled={pending}
        >
          {JACKET_COMFORT.map((option) => (
            <ChoiceRow
              key={option}
              id={`${ids}-jacket-${option}`}
              value={option}
              title={JACKET_COMFORT_LABELS[option]}
            />
          ))}
        </ChoiceList>
      </FieldSet>

      <FieldSet>
        <FieldLegend variant="label">
          How you like the trousers to sit{" "}
          <span className="text-primary" aria-hidden>
            *
          </span>
        </FieldLegend>
        <ChoiceList
          value={form.sheet.trousers ?? ""}
          onValueChange={(value) => form.setTrousers(value as TrouserComfort)}
          aria-label="Trouser comfort"
          disabled={pending}
        >
          {TROUSER_COMFORT.map((option) => (
            <ChoiceRow
              key={option}
              id={`${ids}-trousers-${option}`}
              value={option}
              title={TROUSER_COMFORT_LABELS[option]}
            />
          ))}
        </ChoiceList>
        {form.comfortError ? <FieldError>{form.comfortError}</FieldError> : null}
      </FieldSet>

      <FieldSet>
        <FieldLegend variant="label">
          How you will wear it <span className="font-normal text-muted-foreground">(choose any)</span>
        </FieldLegend>
        <FieldDescription>
          Recorded so the fitter can allow for it: a jacket for long hours seated is cut differently from one for
          standing.
        </FieldDescription>
        <div className="grid border-y border-foreground/15 sm:grid-cols-2">
          {MOVEMENT_OPTIONS.map((movement) => (
            <FieldLabel
              key={movement}
              className="min-h-11 items-center gap-3 border-b border-foreground/10 py-2 font-normal last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0"
            >
              <Checkbox
                checked={form.sheet.movement.includes(movement)}
                onCheckedChange={(checked) => form.toggleMovement(movement, checked)}
                disabled={pending}
              />
              <span className="text-sm">{MOVEMENT_LABELS[movement]}</span>
            </FieldLabel>
          ))}
        </div>
      </FieldSet>

      <FieldSet>
        <FieldLegend variant="label">
          Posture <span className="font-normal text-muted-foreground">(optional)</span>
        </FieldLegend>
        <FieldDescription>
          If you are not sure, leave it; the fitter reads posture from a photograph or at a fitting.
        </FieldDescription>
        <ChoiceList
          value={form.sheet.posture ?? NO_POSTURE}
          onValueChange={(value) => form.setPosture(value === NO_POSTURE ? null : (value as Posture))}
          aria-label="Posture"
          disabled={pending}
        >
          {POSTURE_OPTIONS.map((option) => (
            <ChoiceRow key={option} id={`${ids}-posture-${option}`} value={option} title={POSTURE_LABELS[option]} />
          ))}
          <ChoiceRow id={`${ids}-posture-${NO_POSTURE}`} value={NO_POSTURE} title="I'm not sure" />
        </ChoiceList>
      </FieldSet>

      <Field>
        <FieldLabel htmlFor={`${ids}-notes`}>
          Notes for the fitter <span className="font-normal text-muted-foreground">(optional)</span>
        </FieldLabel>
        <FieldDescription>
          Anything the numbers do not say: a shoulder that sits lower, how an existing jacket fits, a question.
        </FieldDescription>
        <Textarea
          id={`${ids}-notes`}
          value={form.sheet.notes}
          onChange={(event) => form.setNotes(event.target.value)}
          className="min-h-24 rounded-none"
          disabled={pending}
        />
      </Field>

      <PosturePhotosField
        files={photos}
        onChange={setPhotos}
        consent={photoConsent}
        onConsentChange={setPhotoConsent}
        disabled={pending}
      />

      {failure ? (
        <ErrorAlert
          title={source ? "The revision was not sent" : "The sheet was not submitted"}
          message={
            <>
              {failure.message}
              {failure.code === "UNAUTHENTICATED" ? (
                <>
                  {" "}
                  <Link href={signInHref(returnTo)} className="underline underline-offset-4">
                    Sign in
                  </Link>
                </>
              ) : null}
            </>
          }
          onRetry={
            failure.code === "INVALID_INPUT" || failure.code === "UNAUTHENTICATED" ? undefined : () => void submit()
          }
          className="rounded-none"
        />
      ) : null}

      <div className="space-y-3 border-t border-foreground/15 pt-6">
        <div className="flex flex-wrap items-center gap-3">
          {signedIn ? (
            <Button type="submit" className="h-11 rounded-none px-5" disabled={pending} aria-busy={pending}>
              {pending ? <Spinner data-icon="inline-start" aria-label="Submitting" /> : null}
              {pending ? "Submitting…" : source ? "Submit the revision for review" : "Submit for review"}
            </Button>
          ) : (
            <Button
              className="h-11 rounded-none px-5"
              render={<Link href={signInHref(returnTo)} />}
              nativeButton={false}
            >
              Sign in to save measurements
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            className="h-11 rounded-none px-4"
            onClick={form.reset}
            disabled={pending || !form.dirty}
          >
            {source ? "Back to the original values" : "Clear the sheet"}
          </Button>
        </div>
        <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Submitting sends the sheet to a fitter for review. Nothing is approved automatically, and an approved profile
          is never edited in place.
        </p>
      </div>
    </form>
  );
}

function MeasurementRow({
  id,
  number,
  field,
  unit,
  state,
  disabled,
  onChange,
  onBlur,
  onUncertain,
}: {
  id: string;
  number: number;
  field: MeasurementField;
  unit: string;
  state: MeasurementFieldState;
  disabled: boolean;
  onChange: (raw: string) => void;
  onBlur: () => void;
  onUncertain: (on: boolean) => void;
}) {
  const describedBy = [`${id}-guide`, state.error ? `${id}-error` : null, state.hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <li className="grid gap-3 py-4 sm:grid-cols-[2.5rem_minmax(0,1fr)_minmax(10rem,13rem)] sm:items-start sm:gap-5">
      <Mono className="pt-1 text-foreground/60" upper={false}>
        {String(number).padStart(2, "0")}
      </Mono>
      <div className="min-w-0 space-y-1.5">
        <label htmlFor={id} className="text-sm font-medium">
          {field.label}
          {field.required ? (
            <>
              <span className="text-primary" aria-hidden>
                {" "}
                *
              </span>
              <span className="sr-only"> (required)</span>
            </>
          ) : (
            <span className="font-normal text-muted-foreground"> (optional)</span>
          )}
        </label>
        <p id={`${id}-guide`} className="text-xs leading-relaxed text-pretty text-muted-foreground">
          {field.guide}
        </p>
        <FieldLabel className="min-h-9 items-center gap-2 text-xs font-normal text-muted-foreground">
          <Checkbox checked={state.uncertain} onCheckedChange={(checked) => onUncertain(checked)} disabled={disabled} />
          I’m not sure about this one
        </FieldLabel>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Input
            id={id}
            inputMode="decimal"
            autoComplete="off"
            value={state.text}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
            aria-invalid={state.error ? true : undefined}
            aria-describedby={describedBy}
            disabled={disabled}
            className={cn(
              "h-11 rounded-none text-right font-mono tabular-nums",
              state.implausible && !state.error && "border-warning",
            )}
          />
          <span className="w-6 shrink-0 text-xs text-muted-foreground" aria-hidden>
            {unit}
          </span>
        </div>
        {state.error ? <FieldError id={`${id}-error`}>{state.error}</FieldError> : null}
        {state.hint ? (
          <p
            id={`${id}-hint`}
            className={cn("text-xs leading-relaxed", state.implausible ? "text-warning" : "text-muted-foreground")}
          >
            {state.hint}
          </p>
        ) : null}
      </div>
    </li>
  );
}
