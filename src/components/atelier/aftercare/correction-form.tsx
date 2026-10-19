"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";
import {
  CORRECTION_TEXT_MAX,
  KIND_NOTES,
  REQUEST_RECEIVED,
  takesRegion,
} from "@/components/atelier/aftercare/aftercare-words";
import { CorrectionPhotosField } from "@/components/atelier/aftercare/correction-photos-field";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { ChoiceList, ChoiceRow } from "@/components/atelier/fit/choice-list";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useGuestKeyArg } from "@/hooks/atelier/use-owner-args";
import { toClientError, type ClientError } from "@/lib/errors";
import { formatNumber } from "@/lib/format";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { OrderView } from "@convex/atelier/orders";
import {
  CORRECTION_KIND_LABELS,
  FIT_REGION_LABELS,
  FIT_REGIONS,
  type CorrectionKind,
  type FitRegion,
} from "@convex/shared/atelier/enums";

export type CorrectionRequestResult = FunctionReturnType<typeof api.atelier.corrections.request>;

/** Error codes whose message is the final word: sending the same request again cannot succeed. */
const FINAL_CODES: ReadonlySet<string> = new Set(["INVALID_STATE", "NOT_FOUND", "INVALID_INPUT", "CONFLICT"]);

type Props = {
  order: OrderView;
  /** The kinds offered; one kind renders as a fixed line rather than a choice. */
  kinds: readonly CorrectionKind[];
  initialKind: CorrectionKind;
  initialRegion?: FitRegion | null;
  onCancel: () => void;
  onSubmitted?: (result: CorrectionRequestResult) => void;
};

async function uploadPhoto(file: File, getUploadUrl: () => Promise<string>): Promise<Id<"_storage">> {
  const url = await getUploadUrl();
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
  if (!response.ok) throw new Error(`${file.name} did not finish sending. Nothing was requested; try again.`);
  const body = (await response.json()) as { storageId: Id<"_storage"> };
  return body.storageId;
}

/**
 * S31/S32 (C24, C25): one issue on one commission. One `submissionKey` per form instance is reused on
 * every retry, so poor connectivity cannot raise two corrections; photographs are sent only when the
 * request is, and a photograph already stored is not sent twice. Success shows the receipt words and
 * the aftercare case; a duplicate answer from the server is a success too.
 */
export function CorrectionForm({ order, kinds, initialKind, initialRegion = null, onCancel, onSubmitted }: Props) {
  const ids = useId();
  const pathname = usePathname();
  const guestKeyArg = useGuestKeyArg();
  const request = useMutation(api.atelier.corrections.request);
  const generateUploadUrl = useMutation(api.atelier.photos.generateUploadUrl);
  const [submissionKey] = useState(() => crypto.randomUUID());
  const uploaded = useRef(new Map<File, Id<"_storage">>());
  const [kind, setKind] = useState<CorrectionKind>(initialKind);
  const [region, setRegion] = useState<FitRegion | "">(initialRegion ?? "");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [attempted, setAttempted] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [failure, setFailure] = useState<ClientError | null>(null);
  const [result, setResult] = useState<CorrectionRequestResult | null>(null);

  const trimmed = description.trim();
  const needsRegion = takesRegion(kind);
  const errors = {
    region: needsRegion && !region ? "Choose the part of the suit, or “Something else”." : null,
    description: !trimmed
      ? "A few words on what is wrong are needed."
      : trimmed.length > CORRECTION_TEXT_MAX
        ? `Keep it under ${formatNumber(CORRECTION_TEXT_MAX)} characters; it is ${formatNumber(trimmed.length)} now.`
        : null,
  };
  const invalid = errors.region !== null || errors.description !== null;
  const shown = attempted ? errors : { region: null, description: null };

  async function send() {
    setAttempted(true);
    if (invalid || pending) return;
    setFailure(null);
    try {
      const photoStorageIds: Id<"_storage">[] = [];
      for (const [index, file] of files.entries()) {
        setPending(`Sending photograph ${index + 1} of ${files.length}…`);
        const known = uploaded.current.get(file);
        const storageId = known ?? (await uploadPhoto(file, () => generateUploadUrl(guestKeyArg)));
        uploaded.current.set(file, storageId);
        photoStorageIds.push(storageId);
      }
      setPending("Sending your request…");
      const response = await request({
        ...guestKeyArg,
        orderId: order._id,
        kind,
        ...(needsRegion && region ? { region } : {}),
        description: trimmed,
        ...(photoStorageIds.length > 0 ? { photoStorageIds } : {}),
        submissionKey,
      });
      setResult(response);
      onSubmitted?.(response);
    } catch (caught) {
      setFailure(toClientError(caught));
    } finally {
      setPending(null);
    }
  }

  if (result) {
    return (
      <div className="space-y-3 border-t border-foreground/15 pt-5" aria-live="polite">
        <StatusLine tone="success" live className="text-sm">
          {result.duplicate ? `${REQUEST_RECEIVED} · already on record` : REQUEST_RECEIVED}
        </StatusLine>
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="text-muted-foreground">Aftercare request</span>
          <Mono upper={false} className="text-foreground">
            {result.caseId}
          </Mono>
        </p>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          A member of the house takes it up and you will see their name on the request. Nothing proceeds without your
          acceptance of what they propose; the specification and the fit profile this suit was cut to stay on record.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            className="h-11 rounded-none px-5"
            render={<Link href={routes.atelier.request(result.caseId)} />}
            nativeButton={false}
          >
            Open the conversation
          </Button>
          <Button variant="ghost" className="h-11 rounded-none px-4" onClick={onCancel}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="max-w-3xl space-y-8 border-t border-foreground/15 pt-6"
      noValidate
      aria-label={CORRECTION_KIND_LABELS[kind]}
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void send();
      }}
    >
      {kinds.length > 1 ? (
        <FieldSet>
          <FieldLegend variant="label">What is needed</FieldLegend>
          <ChoiceList
            value={kind}
            onValueChange={(value) => setKind(value as CorrectionKind)}
            aria-label="What is needed"
            disabled={pending !== null}
          >
            {kinds.map((candidate) => (
              <ChoiceRow
                key={candidate}
                id={`${ids}-kind-${candidate}`}
                value={candidate}
                title={CORRECTION_KIND_LABELS[candidate]}
                description={KIND_NOTES[candidate]}
              />
            ))}
          </ChoiceList>
        </FieldSet>
      ) : (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">{CORRECTION_KIND_LABELS[kind]}</p>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{KIND_NOTES[kind]}</p>
        </div>
      )}

      {needsRegion ? (
        <FieldSet>
          <FieldLegend variant="label">
            Where{" "}
            <span className="text-primary" aria-hidden>
              *
            </span>
          </FieldLegend>
          <FieldDescription>
            A fit concern is reviewed against the fit profile this suit was cut to; a detail that does not match the
            design is a manufacturing check and leaves your profile unchanged.
          </FieldDescription>
          <ChoiceList
            value={region}
            onValueChange={(value) => setRegion(value as FitRegion)}
            aria-label="Where"
            disabled={pending !== null}
          >
            {FIT_REGIONS.map((candidate) => (
              <ChoiceRow
                key={candidate}
                id={`${ids}-region-${candidate}`}
                value={candidate}
                title={FIT_REGION_LABELS[candidate]}
              />
            ))}
          </ChoiceList>
          {shown.region ? <FieldError>{shown.region}</FieldError> : null}
        </FieldSet>
      ) : null}

      <Field data-invalid={shown.description ? true : undefined}>
        <FieldLabel htmlFor={`${ids}-description`}>
          What is wrong{" "}
          <span className="text-primary" aria-hidden>
            *
          </span>
        </FieldLabel>
        <FieldDescription>
          Say what you see and feel, in your own words. The house reads this on your request and replies there.
        </FieldDescription>
        <Textarea
          id={`${ids}-description`}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          disabled={pending !== null}
          aria-invalid={shown.description ? true : undefined}
          className="min-h-28 rounded-none text-base md:text-sm"
        />
        {shown.description ? <FieldError>{shown.description}</FieldError> : null}
      </Field>

      <CorrectionPhotosField files={files} onChange={setFiles} disabled={pending !== null} />

      {failure ? (
        <ErrorAlert
          title="The request was not sent"
          message={
            failure.code === "UNAUTHENTICATED" ? (
              <>
                This commission belongs to an account.{" "}
                <Link
                  href={`${routes.signIn}?redirect_url=${encodeURIComponent(pathname)}`}
                  className="underline underline-offset-4"
                >
                  Sign in
                </Link>{" "}
                and your words are still here.
              </>
            ) : (
              `${failure.message} Your words are still here.`
            )
          }
          onRetry={FINAL_CODES.has(failure.code) || failure.code === "UNAUTHENTICATED" ? undefined : () => void send()}
          retryLabel="Send again"
          className="rounded-none"
        />
      ) : null}

      <div className="space-y-3 border-t border-foreground/15 pt-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            className="h-11 rounded-none px-5"
            disabled={pending !== null}
            aria-busy={pending !== null}
          >
            {pending ? <Spinner data-icon="inline-start" aria-label="Sending" /> : null}
            {pending ? "Sending…" : "Send to the house"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 rounded-none px-4"
            onClick={onCancel}
            disabled={pending !== null}
          >
            Cancel
          </Button>
          {pending ? (
            <StatusLine live tone="neutral">
              {pending}
            </StatusLine>
          ) : null}
        </div>
        <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Sending opens an aftercare request with the house; it is received, not yet decided. Your design and your fit
          profile are unchanged.
        </p>
      </div>
    </form>
  );
}
