"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { WordSelect } from "@/components/atelier/staff/case/word-select";
import { dateInputToTimestamp } from "@/components/atelier/staff/production/date-input";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { reportError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { api } from "@convex/_generated/api";
import type { StaffCorrectionView } from "@convex/atelier/corrections";
import {
  CORRECTION_KIND_LABELS,
  CORRECTION_KINDS,
  CORRECTION_STATUS_LABELS,
  REMEDY_COVERAGE_LABELS,
  REMEDY_COVERAGES,
  type CorrectionKind,
  type RemedyCoverage,
} from "@convex/shared/atelier/enums";
import { HOUSE_POLICY } from "@convex/shared/atelier/policy";

const COVERAGE_HINTS: Record<RemedyCoverage, string> = {
  included: HOUSE_POLICY.verified.alterations,
  member_included: HOUSE_POLICY.verified.memberAlterations,
  quoted: "Needs an amount; the client reads it before accepting.",
  store_credit: HOUSE_POLICY.verified.storeCredit,
};

/** O07 step 2: a remedy with real coverage, logistics, timing and an approval owner. The client accepts it on their order. */
export function RemedyForm({ correction }: { correction: StaffCorrectionView }) {
  const proposeRemedy = useMutation(api.atelier.corrections.proposeRemedy);
  const [kind, setKind] = useState<CorrectionKind>(correction.remedy?.kind ?? correction.kind);
  const [coverage, setCoverage] = useState<RemedyCoverage | null>(correction.remedy?.coverage ?? null);
  const [amount, setAmount] = useState(
    correction.remedy?.amountUsd !== null && correction.remedy?.amountUsd !== undefined
      ? String(correction.remedy.amountUsd)
      : "",
  );
  const [logistics, setLogistics] = useState(correction.remedy?.logistics ?? "");
  const [deadline, setDeadline] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const amountValue = amount.trim() === "" ? undefined : Number(amount);
  const amountOk =
    amountValue === undefined
      ? coverage !== "quoted"
      : Number.isFinite(amountValue) && amountValue >= 0 && (coverage !== "quoted" || amountValue > 0);
  const deadlineAt = deadline ? dateInputToTimestamp(deadline) : null;
  const deadlineOk = deadline === "" || (deadlineAt !== null && deadlineAt > now);
  const ready = coverage !== null && logistics.trim().length > 0 && amountOk && deadlineOk;

  async function submit() {
    if (!coverage) return;
    setPending(true);
    setError(null);
    try {
      await proposeRemedy({
        correctionId: correction._id,
        remedy: {
          kind,
          coverage,
          logistics: logistics.trim(),
          ...(amountValue !== undefined ? { amountUsd: amountValue } : {}),
          ...(deadlineAt !== null ? { deadline: deadlineAt } : {}),
        },
      });
      toast.success(`Proposed. The client reads “${CORRECTION_STATUS_LABELS.remedy_proposed}” and can accept it.`);
    } catch (caught) {
      setError(reportError(caught).message);
    } finally {
      setPending(false);
    }
  }

  const kindOptions = CORRECTION_KINDS.map((candidate) => ({
    code: candidate,
    label: CORRECTION_KIND_LABELS[candidate],
  }));
  const coverageOptions = REMEDY_COVERAGES.map((candidate) => ({
    code: candidate,
    label: REMEDY_COVERAGE_LABELS[candidate],
    description: COVERAGE_HINTS[candidate],
  }));

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) void submit();
      }}
    >
      <h3 className="text-base font-medium">{correction.remedy ? "Propose a different remedy" : "Propose a remedy"}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`remedy-kind-${correction._id}`}>Remedy</FieldLabel>
          <FieldDescription>
            What the house will do. The client asked for {correction.kindLabel.toLowerCase()}.
          </FieldDescription>
          <WordSelect id={`remedy-kind-${correction._id}`} value={kind} onValueChange={setKind} options={kindOptions} />
        </Field>
        <Field>
          <FieldLabel htmlFor={`remedy-coverage-${correction._id}`}>Coverage</FieldLabel>
          <FieldDescription>Who bears the cost, in the client&rsquo;s words.</FieldDescription>
          <WordSelect
            id={`remedy-coverage-${correction._id}`}
            value={coverage}
            onValueChange={setCoverage}
            options={coverageOptions}
            placeholder="Choose the coverage"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`remedy-amount-${correction._id}`}>Amount (USD)</FieldLabel>
          <FieldDescription>
            {coverage === "quoted" ? "Required for a remedy quoted separately." : "Optional; zero or more."}
          </FieldDescription>
          <Input
            id={`remedy-amount-${correction._id}`}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="rounded-sm"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`remedy-deadline-${correction._id}`}>Target date</FieldLabel>
          <FieldDescription>Optional and in the future. The client reads it with the word “Estimate”.</FieldDescription>
          <Input
            id={`remedy-deadline-${correction._id}`}
            type="date"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
            className="rounded-sm"
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor={`remedy-logistics-${correction._id}`}>Logistics</FieldLabel>
        <FieldDescription>
          Required. What the client does next: bring the suit to a showroom, wait for a label, send it back.
        </FieldDescription>
        <Textarea
          id={`remedy-logistics-${correction._id}`}
          value={logistics}
          onChange={(event) => setLogistics(event.target.value)}
          rows={3}
          className="rounded-sm"
        />
      </Field>
      {error ? <ErrorAlert title="The remedy was not proposed" message={error} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || !ready} className="h-10 rounded-none px-4">
          {pending ? <Spinner data-icon="inline-start" /> : null}
          Propose remedy
        </Button>
        <p className="text-xs text-muted-foreground">
          Client reads: <span className="text-foreground">“{CORRECTION_STATUS_LABELS.remedy_proposed}”</span>
          {coverage ? ` · ${REMEDY_COVERAGE_LABELS[coverage]}` : ""}
          {deadlineAt !== null ? ` · ${formatDate(deadlineAt)} · Estimate` : ""}
        </p>
      </div>
    </form>
  );
}
