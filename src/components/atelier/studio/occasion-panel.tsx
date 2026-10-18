"use client";

import { useMutation } from "convex/react";
import { format } from "date-fns";
import { useId, useState } from "react";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { StatusLine } from "@/components/atelier/common/status-line";
import { useStudio } from "@/components/atelier/studio/panel-contract";
import { ShadeChip } from "@/components/atelier/studio/cloth/shade-chip";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ErrorAlert } from "@/components/common/error-alert";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { reportError, type ClientError } from "@/lib/errors";
import { formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";
import { clothSeedByCode } from "@convex/shared/atelier/cloths";
import { OCCASION_BLURBS, OCCASION_LABELS, OCCASIONS, type Occasion } from "@convex/shared/atelier/enums";
import { looksForOccasion, type Look } from "@convex/shared/atelier/looks";
import { eventReadiness, HOUSE_POLICY } from "@convex/shared/atelier/policy";
import {
  DEFAULT_SPEC,
  GARMENT_OPTIONS,
  LAPEL_OPTIONS,
  PLEAT_OPTIONS,
  POCKET_OPTIONS,
  specHash,
  type SuitSpec,
} from "@convex/shared/atelier/spec";

const DATE_INPUT = "yyyy-MM-dd";

function toDateInput(timestamp: number | undefined): string {
  return timestamp === undefined ? "" : format(timestamp, DATE_INPUT);
}

/** A date input's value as local noon, so the day the client typed is the day the house reads. */
function fromDateInput(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const timestamp = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function lookDetails(spec: SuitSpec): string {
  const label = <T extends string>(options: readonly { code: T; label: string }[], code: T) =>
    options.find((option) => option.code === code)?.label ?? code;
  return [
    label(GARMENT_OPTIONS, spec.garment),
    spec.jacket.breast === "double" ? "double-breasted" : null,
    label(LAPEL_OPTIONS, spec.jacket.lapel).toLowerCase(),
    label(POCKET_OPTIONS, spec.jacket.pockets).toLowerCase(),
    label(PLEAT_OPTIONS, spec.trousers.pleats).toLowerCase(),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * The occasion step (S02, C02): what the suit is for, when, and the house's recommended looks for it.
 * The form is provisional until saved, so Cancel leaves the draft exactly as it was; a look replaces
 * the design only after the client confirms, and changing the occasion never touches the spec.
 */
export function OccasionPanel() {
  const { draft, draftId, guestKeyArg, catalogue, goToStep } = useStudio();
  const saveOccasion = useMutation(api.atelier.drafts.setOccasion);
  const applyLook = useMutation(api.atelier.drafts.applyLook);
  const dateId = useId();
  const useId_ = useId();

  const [now] = useState(() => Date.now());
  const [occasion, setOccasion] = useState<Occasion | null>(draft.occasion ?? null);
  const [eventDate, setEventDate] = useState(toDateInput(draft.eventDate));
  const [intendedUse, setIntendedUse] = useState(draft.intendedUse ?? "");
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [confirmLook, setConfirmLook] = useState<Look | null>(null);
  const [failure, setFailure] = useState<ClientError | null>(null);

  const locked = draft.status !== "draft";
  const dirty =
    occasion !== (draft.occasion ?? null) ||
    eventDate !== toDateInput(draft.eventDate) ||
    intendedUse.trim() !== (draft.intendedUse ?? "");
  const eventMs = fromDateInput(eventDate);
  const readiness = eventReadiness(eventMs ?? undefined, now);
  const looks = looksForOccasion(occasion ?? undefined);
  const currentHash = specHash(draft.spec);
  const hasChoices = currentHash !== specHash(DEFAULT_SPEC);

  async function save(): Promise<boolean> {
    if (!occasion) {
      setFailure({ code: "INVALID_INPUT", message: "Choose an occasion first." });
      return false;
    }
    setSaving(true);
    setFailure(null);
    try {
      await saveOccasion({
        draftId,
        ...guestKeyArg,
        occasion,
        eventDate: eventMs ?? undefined,
        intendedUse: intendedUse.trim() || undefined,
      });
      return true;
    } catch (error) {
      setFailure(reportError(error));
      return false;
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setOccasion(draft.occasion ?? null);
    setEventDate(toDateInput(draft.eventDate));
    setIntendedUse(draft.intendedUse ?? "");
    setFailure(null);
  }

  async function applyAndContinue(look: Look) {
    setApplying(look.key);
    try {
      if (dirty && occasion) {
        const saved = await save();
        if (!saved) return;
      }
      await applyLook({ draftId, ...guestKeyArg, lookKey: look.key });
      goToStep("cloth");
    } catch (error) {
      reportError(error);
    } finally {
      setApplying(null);
    }
  }

  function startFromLook(look: Look) {
    if (hasChoices && specHash(look.spec) !== currentHash) {
      setConfirmLook(look);
      return;
    }
    void applyAndContinue(look);
  }

  async function browseAll() {
    if (dirty && occasion) {
      const saved = await save();
      if (!saved) return;
    }
    goToStep("cloth");
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h2 className="text-xl font-medium tracking-tight sm:text-2xl">Occasion</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Tell the house what the suit is for. The recommendations change with it; nothing you have already chosen is
          reset.
        </p>
      </header>

      {locked ? (
        <Alert className="rounded-none">
          <AlertTitle>This design has been sent to the house</AlertTitle>
          <AlertDescription>
            Its occasion and date are part of the request; tell your concierge if they change.
          </AlertDescription>
        </Alert>
      ) : null}

      <form
        className="space-y-6"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <FieldSet>
          <FieldLegend variant="label">What is it for?</FieldLegend>
          <RadioGroup
            value={occasion ?? ""}
            onValueChange={(value) => setOccasion(value as Occasion)}
            className="gap-0 divide-y divide-foreground/10 border-y border-foreground/15"
            aria-label="Occasion"
            disabled={locked}
          >
            {OCCASIONS.map((value) => (
              <FieldLabel
                key={value}
                className={cn(
                  "flex w-full cursor-pointer items-start gap-3 py-3 pr-2 pl-1 font-normal",
                  occasion === value && "bg-primary/5",
                )}
              >
                <RadioGroupItem value={value} className="mt-1" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{OCCASION_LABELS[value]}</span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">{OCCASION_BLURBS[value]}</span>
                </span>
              </FieldLabel>
            ))}
          </RadioGroup>
        </FieldSet>

        <Field>
          <FieldLabel htmlFor={dateId}>
            Event date <span className="font-normal text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Input
            id={dateId}
            type="date"
            value={eventDate}
            onChange={(event) => setEventDate(event.target.value)}
            className="h-11 rounded-none sm:max-w-xs"
            disabled={locked}
          />
          {readiness.state === "none" ? (
            <FieldDescription>
              {HOUSE_POLICY.verified.leadTime} The date tells your concierge when your first fitting must happen, not
              when the suit arrives.
            </FieldDescription>
          ) : (
            <StatusLine
              tone={
                readiness.state === "comfortable" ? "neutral" : readiness.state === "tight" ? "warning" : "destructive"
              }
              live
              className="items-start text-xs leading-relaxed [&>span:first-child]:mt-1.5"
            >
              {readiness.copy}
            </StatusLine>
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor={useId_}>
            Intended use <span className="font-normal text-muted-foreground">(optional)</span>
          </FieldLabel>
          <Input
            id={useId_}
            value={intendedUse}
            onChange={(event) => setIntendedUse(event.target.value)}
            maxLength={280}
            placeholder="A September wedding in Charlotte; the reception runs late."
            className="h-11 rounded-none"
            disabled={locked}
          />
          <FieldDescription>A line for your concierge.</FieldDescription>
        </Field>

        {failure ? (
          <ErrorAlert
            title="The occasion was not saved"
            message={`${failure.message} Your choices are still here.`}
            onRetry={() => void save()}
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" className="h-11 rounded-none px-5" disabled={!dirty || !occasion || saving || locked}>
            {saving ? <Spinner data-icon="inline-start" aria-label="Saving" /> : null}
            Save occasion
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 rounded-none"
            onClick={cancel}
            disabled={!dirty || saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-none px-5 sm:ml-auto"
            onClick={() => void browseAll()}
            disabled={saving || applying !== null}
          >
            Browse all cloths
          </Button>
        </div>
        {dirty && !saving ? <StatusLine tone="warning">Not saved yet</StatusLine> : null}
      </form>

      <AtelierSection
        id="recommended-looks"
        level={3}
        title={occasion ? `Looks for ${OCCASION_LABELS[occasion].toLowerCase()}` : "Looks from the house"}
        description="Each starts your design in a real cloth with its cut decided; everything stays yours to change."
      >
        <ul className="divide-y divide-foreground/10 border-y border-foreground/15">
          {looks.map((look) => {
            const code = look.spec.clothCode;
            const entry = code && catalogue ? catalogue.cloths.find((cloth) => cloth.code === code) : undefined;
            const seed = code ? clothSeedByCode(code) : undefined;
            const isCurrent = draft.lookKey === look.key && specHash(look.spec) === currentHash;
            return (
              <li key={look.key} className="grid gap-3 py-4 sm:grid-cols-[auto_1fr_auto] sm:items-start">
                <span
                  aria-hidden
                  className="hidden size-12 shrink-0 rounded-[2px] border border-foreground/20 sm:block"
                  style={{ backgroundColor: entry?.hex ?? seed?.hex ?? "var(--muted)" }}
                />
                <div className="min-w-0 space-y-1.5">
                  <p className="text-sm font-medium">
                    {look.name}{" "}
                    <span className="font-display text-base font-normal text-muted-foreground italic">
                      {look.properName}
                    </span>
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{look.why}</p>
                  <p className="text-xs text-muted-foreground">{lookDetails(look.spec)}</p>
                  {catalogue === undefined ? (
                    <Skeleton className="h-4 w-48 rounded-sm" />
                  ) : entry ? (
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <ShadeChip hex={entry.hex} confirmed={entry.shadeConfirmed} words={false} />
                      <span className="font-medium">{entry.name}</span>
                      {entry.mill ? <span className="text-muted-foreground">{entry.mill}</span> : null}
                      <span className="text-muted-foreground">
                        {entry.priceUsd !== undefined
                          ? `From ${formatUsd(entry.priceUsd)}`
                          : "Price confirmed with your quote"}
                      </span>
                      {!entry.shadeConfirmed ? (
                        <span className="text-muted-foreground">representative shade</span>
                      ) : null}
                    </p>
                  ) : (
                    <p className="text-xs text-warning">
                      {seed?.name ?? code ?? "Its cloth"} is not offered at the moment; the look still applies and you
                      choose another cloth next.
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  className="h-11 rounded-none px-4"
                  onClick={() => startFromLook(look)}
                  disabled={applying !== null || saving || locked || isCurrent}
                >
                  {applying === look.key ? <Spinner data-icon="inline-start" aria-label="Applying" /> : null}
                  {isCurrent ? "Your current design" : "Start from this look"}
                </Button>
              </li>
            );
          })}
        </ul>
      </AtelierSection>

      <ConfirmDialog
        open={confirmLook !== null}
        onOpenChange={(open) => (open ? undefined : setConfirmLook(null))}
        title="Replace your design with this look?"
        description={
          confirmLook
            ? `${confirmLook.name} replaces your cloth, style and details with its own. Your occasion, date and shortlist stay. Cancel keeps everything as it is.`
            : undefined
        }
        confirmLabel="Replace with this look"
        onConfirm={() => (confirmLook ? applyAndContinue(confirmLook) : undefined)}
      />
    </div>
  );
}
