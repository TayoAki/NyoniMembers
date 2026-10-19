"use client";

import { useMutation } from "convex/react";
import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Mono } from "@/components/atelier/common/mono";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { toClientError } from "@/lib/errors";
import { formatUsd } from "@/lib/format";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { EligibilityView } from "@convex/atelier/benefits";
import type { StaffCaseView } from "@convex/atelier/cases";
import type { QuoteView } from "@convex/atelier/quotes";
import { ATELIER_LIMITS, QUOTE_LINE_KINDS, type QuoteLineKind } from "@convex/shared/atelier/enums";
import { HOUSE_POLICY } from "@convex/shared/atelier/policy";
import { computeTotals, QUOTE_LINE_KIND_LABELS, validateLines } from "./case-words";
import { WordSelect } from "./word-select";

type LineDraft = { key: string; code: string; label: string; amount: string; kind: QuoteLineKind };

const DAY_MS = 86_400_000;

function newLine(partial: Partial<LineDraft> = {}): LineDraft {
  return { key: crypto.randomUUID(), code: "", label: "", amount: "", kind: "option", ...partial };
}

function toDateInput(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A date input names a day; the quote stays open until the end of it in the staff member's zone. */
function endOfDay(value: string): number | null {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 23, 59, 59).getTime();
}

const KIND_OPTIONS = QUOTE_LINE_KINDS.map((kind) => ({ code: kind, label: QUOTE_LINE_KIND_LABELS[kind] }));

/**
 * A04 (O04): finance prices the submitted revision. Lines carry a code, a label, an amount and a kind;
 * the house computes the totals from them (the same `computeTotals` the server uses), never the other way
 * round. Terms start from the house's final-sale rule; expiry defaults to the house's quote window. Create
 * makes a draft to offer later; superseding creates and offers a new version in one step.
 */
export function QuoteComposer({
  caseView,
  supersede,
  eligibility,
  onDone,
}: {
  caseView: StaffCaseView;
  /** The quote being replaced; its lines and terms prefill the form. */
  supersede?: QuoteView | null;
  eligibility: EligibilityView | null;
  onDone?: () => void;
}) {
  const create = useMutation(api.atelier.quotes.create);
  const supersedeQuote = useMutation(api.atelier.quotes.supersede);
  const garmentLine = caseView.revision?.lines.find((line) => line.section === "Garment");
  const [lines, setLines] = useState<LineDraft[]>(() =>
    supersede
      ? supersede.lines.map((line) =>
          newLine({ code: line.code, label: line.label, amount: String(line.amountUsd), kind: line.kind }),
        )
      : [
          newLine({
            code: garmentLine?.productionId ?? "COMMISSION",
            label: garmentLine ? `${garmentLine.value} commission` : "Commission",
            kind: "commission",
          }),
        ],
  );
  const [leadTime, setLeadTime] = useState(
    supersede?.leadTimeWeeks !== null && supersede?.leadTimeWeeks !== undefined ? String(supersede.leadTimeWeeks) : "6",
  );
  const [fittings, setFittings] = useState(
    supersede?.fittingsIncluded !== null && supersede?.fittingsIncluded !== undefined
      ? String(supersede.fittingsIncluded)
      : "",
  );
  const [terms, setTerms] = useState(supersede?.terms ?? HOUSE_POLICY.verified.finalSale);
  const [now] = useState(() => Date.now());
  const [expires, setExpires] = useState(() => toDateInput(now + ATELIER_LIMITS.quoteValidDays * DAY_MS));
  const reservation = eligibility?.redemption?.status === "reserved" ? eligibility.redemption : null;
  const [carryBenefit, setCarryBenefit] = useState(Boolean(reservation));
  const [touched, setTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(
    () =>
      lines.map((line) => ({
        code: line.code,
        label: line.label,
        amountUsd: line.amount.trim() === "" ? Number.NaN : Number(line.amount),
        kind: line.kind,
      })),
    [lines],
  );
  const lineErrors = useMemo(() => validateLines(parsed), [parsed]);
  const totals = useMemo(() => (lineErrors.length === 0 ? computeTotals(parsed) : null), [parsed, lineErrors]);
  const expiresAt = endOfDay(expires);
  const expiryOk = expiresAt !== null && expiresAt > now;
  const leadTimeValue = leadTime.trim() === "" ? undefined : Number(leadTime);
  const fittingsValue = fittings.trim() === "" ? undefined : Number(fittings);
  const countsOk =
    (leadTimeValue === undefined || (Number.isInteger(leadTimeValue) && leadTimeValue >= 0)) &&
    (fittingsValue === undefined || (Number.isInteger(fittingsValue) && fittingsValue >= 0));

  const blocker = !caseView.revision
    ? "This request has no submitted design to price yet."
    : caseView.draftRevision !== null && caseView.draftRevision !== caseView.revision.revision
      ? "The design has moved on since it was submitted. The client must send it again, or accept the proposal that changed it, before it is priced."
      : !caseView.open
        ? `This request is ${caseView.statusLabel.toLowerCase()}; a quote cannot be prepared on it.`
        : null;

  const canSubmit =
    blocker === null && lineErrors.length === 0 && terms.trim().length > 0 && expiryOk && countsOk && !pending;
  const id = `quote-${caseView._id}`;

  function update(key: string, change: Partial<LineDraft>) {
    setTouched(true);
    setLines((previous) => previous.map((line) => (line.key === key ? { ...line, ...change } : line)));
  }

  async function submit() {
    if (expiresAt === null) return;
    setTouched(true);
    setPending(true);
    setError(null);
    const input = {
      lines: parsed,
      ...(leadTimeValue !== undefined ? { leadTimeWeeks: leadTimeValue } : {}),
      ...(fittingsValue !== undefined ? { fittingsIncluded: fittingsValue } : {}),
      terms: terms.trim(),
      expiresAt,
      ...(carryBenefit && reservation
        ? { benefitRedemptionId: reservation.redemptionId as Id<"atelierBenefitRedemptions"> }
        : {}),
    };
    try {
      if (supersede) {
        await supersedeQuote({ quoteId: supersede._id, ...input });
        toast.success(`Version ${supersede.version} replaced and the new version offered to the client.`);
      } else {
        await create({ caseId: caseView._id, ...input });
        toast.success("Quote created as a draft. Offer it when it is ready; the client does not see a draft.");
      }
      onDone?.();
    } catch (caught) {
      setError(toClientError(caught).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-base font-medium">
          {supersede ? `Replace version ${supersede.version}` : "Prepare a quote"}
        </h3>
        {caseView.revision ? <Mono>prices revision {caseView.revision.revision}</Mono> : null}
      </div>
      {blocker ? <p className="text-sm leading-relaxed text-warning">{blocker}</p> : null}

      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground">Lines</p>
        <div className="divide-y divide-foreground/10 border-y border-foreground/15">
          {lines.map((line, index) => (
            <div key={line.key} className="grid gap-2 py-3 sm:grid-cols-[7rem_1fr_7rem_9rem_auto] sm:items-end">
              <Field>
                <FieldLabel htmlFor={`${id}-code-${line.key}`} className="text-xs text-muted-foreground">
                  Code
                </FieldLabel>
                <Input
                  id={`${id}-code-${line.key}`}
                  value={line.code}
                  onChange={(event) => update(line.key, { code: event.target.value })}
                  className="font-mono text-xs uppercase"
                  autoComplete="off"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-label-${line.key}`} className="text-xs text-muted-foreground">
                  Label
                </FieldLabel>
                <Input
                  id={`${id}-label-${line.key}`}
                  value={line.label}
                  onChange={(event) => update(line.key, { label: event.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-amount-${line.key}`} className="text-xs text-muted-foreground">
                  Amount (USD)
                </FieldLabel>
                <Input
                  id={`${id}-amount-${line.key}`}
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={line.amount}
                  onChange={(event) => update(line.key, { amount: event.target.value })}
                  className="tabular-nums"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-kind-${line.key}`} className="text-xs text-muted-foreground">
                  Kind
                </FieldLabel>
                <WordSelect
                  id={`${id}-kind-${line.key}`}
                  value={line.kind}
                  options={KIND_OPTIONS}
                  onValueChange={(kind) => update(line.key, { kind })}
                />
              </Field>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove line ${index + 1}`}
                disabled={lines.length === 1}
                onClick={() => setLines((previous) => previous.filter((entry) => entry.key !== line.key))}
              >
                <X />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setLines((previous) => [...previous, newLine()])}
          >
            <Plus data-icon="inline-start" aria-hidden />
            Add line
          </Button>
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm tabular-nums">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="font-medium">{totals ? formatUsd(totals.subtotalUsd) : "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Total</dt>
              <dd className="font-medium">{totals ? formatUsd(totals.totalUsd) : "—"}</dd>
            </div>
          </dl>
        </div>
        {touched && lineErrors.length > 0 ? (
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-destructive" role="alert">
            {lineErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}
        <p className="text-xs leading-relaxed text-muted-foreground">
          Commission, cloth and option lines make the subtotal; delivery, tax, a membership benefit and adjustments sit
          below it. A benefit or adjustment takes money off, so its amount is zero or negative.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor={`${id}-lead`}>Lead time (weeks)</FieldLabel>
          <FieldDescription>Read as “about n weeks from your first fitting”.</FieldDescription>
          <Input
            id={`${id}-lead`}
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={leadTime}
            onChange={(event) => setLeadTime(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-fittings`}>Fittings included</FieldLabel>
          <FieldDescription>Leave blank when it is not yet known.</FieldDescription>
          <Input
            id={`${id}-fittings`}
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={fittings}
            onChange={(event) => setFittings(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-expires`}>Expires</FieldLabel>
          <FieldDescription>The house&rsquo;s window is {ATELIER_LIMITS.quoteValidDays} days.</FieldDescription>
          <Input
            id={`${id}-expires`}
            type="date"
            value={expires}
            onChange={(event) => setExpires(event.target.value)}
            aria-invalid={!expiryOk}
          />
        </Field>
      </div>
      {!countsOk ? <p className="text-sm text-destructive">Lead time and fittings are whole numbers.</p> : null}

      <Field>
        <FieldLabel htmlFor={`${id}-terms`}>Terms</FieldLabel>
        <FieldDescription>
          Shown to the client as given. The final-sale rule is the house&rsquo;s own words; add what else applies.
        </FieldDescription>
        <Textarea id={`${id}-terms`} value={terms} onChange={(event) => setTerms(event.target.value)} rows={3} />
      </Field>

      {reservation ? (
        <Label htmlFor={`${id}-benefit`} className="flex min-h-11 items-start gap-3 font-normal">
          <Checkbox
            id={`${id}-benefit`}
            checked={carryBenefit}
            onCheckedChange={(checked) => setCarryBenefit(checked === true)}
            className="mt-0.5"
          />
          <span className="text-sm leading-snug">
            Carry the member&rsquo;s reserved included suit ({eligibility?.tierLabel}, {reservation.yearKey}) onto this
            quote.
            <span className="block text-xs text-muted-foreground">
              The reservation moves to the new version; it is used only when the client accepts.
            </span>
          </span>
        </Label>
      ) : null}

      {error ? (
        <ErrorAlert title={supersede ? "The quote was not replaced" : "The quote was not created"} message={error} />
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button className="h-10 rounded-none px-5" disabled={!canSubmit} onClick={() => void submit()}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {supersede ? "Replace and offer" : "Create as draft"}
        </Button>
        {onDone ? (
          <Button variant="ghost" className="h-10" disabled={pending} onClick={onDone}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}
