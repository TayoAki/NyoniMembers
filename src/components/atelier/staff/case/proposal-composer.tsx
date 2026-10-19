"use client";

import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChoiceList, ChoiceRow } from "@/components/atelier/fit/choice-list";
import { Mono } from "@/components/atelier/common/mono";
import { ErrorAlert } from "@/components/common/error-alert";
import { LoadingRows } from "@/components/common/loading-grid";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { toClientError } from "@/lib/errors";
import { api } from "@convex/_generated/api";
import type { StaffCaseView } from "@convex/atelier/cases";
import type { CatalogueEntryView } from "@convex/atelier/views";
import { COMMERCIAL_IMPACTS, type CommercialImpact } from "@convex/shared/atelier/enums";
import {
  applyChange,
  describeSpec,
  specHash,
  validateSpec,
  type SpecNames,
  type SpecPatch,
  type SuitSpec,
} from "@convex/shared/atelier/spec";
import { COMMERCIAL_IMPACT_WORDS } from "./case-words";
import { ChangesList } from "./proposal-list";
import { SpecFields, type SpecCatalogue } from "./spec-fields";

/** Later changes layer onto earlier ones; the garment parts merge field by field like `applyChange` does. */
function mergePatch(previous: SpecPatch, next: SpecPatch): SpecPatch {
  return {
    ...previous,
    ...next,
    jacket: next.jacket ? { ...previous.jacket, ...next.jacket } : previous.jacket,
    trousers: next.trousers ? { ...previous.trousers, ...next.trousers } : previous.trousers,
    waistcoat:
      next.waistcoat === undefined
        ? previous.waistcoat
        : next.waistcoat === null
          ? null
          : { ...(previous.waistcoat ?? {}), ...next.waistcoat },
  };
}

function namesFor(spec: SuitSpec, catalogue: SpecCatalogue): SpecNames {
  const find = (entries: CatalogueEntryView[], code: string | null) =>
    code ? entries.find((entry) => entry.code === code) : undefined;
  const cloth = find(catalogue.cloths, spec.clothCode);
  const button = find(catalogue.buttons, spec.buttonCode);
  const lining = find(catalogue.linings, spec.liningCode);
  return {
    cloth: cloth ? { name: cloth.name, mill: cloth.mill, code: cloth.code } : null,
    button: button ? { name: button.name, code: button.code } : null,
    lining: lining ? { name: lining.name, code: lining.code } : null,
  };
}

/**
 * Starts from the client's current design and edits it through the same option lists the client uses.
 * The tailoring rules run on every change, so what is proposed is always manufacturable, and every line
 * the rules moved beyond what was asked is listed before it is sent. The client decides; nothing changes here.
 */
export function ProposalComposer({ caseView }: { caseView: StaffCaseView }) {
  const cloths = useQuery(api.atelier.catalogue.list, { kind: "cloth" });
  const buttons = useQuery(api.atelier.catalogue.list, { kind: "button" });
  const linings = useQuery(api.atelier.catalogue.list, { kind: "lining" });
  if (!caseView.draft) return null;
  if (cloths === undefined || buttons === undefined || linings === undefined) return <LoadingRows count={4} />;
  return (
    <ComposerForm
      caseView={caseView}
      base={caseView.draft.spec}
      baseRevision={caseView.draft.revision}
      catalogue={{ cloths, buttons, linings }}
    />
  );
}

function ComposerForm({
  caseView,
  base,
  baseRevision,
  catalogue,
}: {
  caseView: StaffCaseView;
  base: SuitSpec;
  baseRevision: number;
  catalogue: SpecCatalogue;
}) {
  const propose = useMutation(api.atelier.cases.propose);
  const [patch, setPatch] = useState<SpecPatch>({});
  const [rationale, setRationale] = useState("");
  const [impact, setImpact] = useState<CommercialImpact>("none");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { spec: afterSpec, conflicts } = useMemo(() => applyChange(base, patch), [base, patch]);
  const errors = useMemo(() => validateSpec(afterSpec), [afterSpec]);
  const changed = specHash(afterSpec) !== specHash(base);
  const changes = useMemo(() => {
    const before = describeSpec(base, namesFor(base, catalogue));
    const after = describeSpec(afterSpec, namesFor(afterSpec, catalogue));
    return after
      .map((line) => {
        const previous = before.find((entry) => entry.section === line.section && entry.label === line.label);
        if (previous && previous.value === line.value && previous.productionId === line.productionId) return null;
        return {
          section: line.section,
          label: line.label,
          from: previous?.value ?? "—",
          to: line.value,
          fromProductionId: previous?.productionId ?? null,
          toProductionId: line.productionId ?? null,
        };
      })
      .filter((entry) => entry !== null);
  }, [afterSpec, base, catalogue]);

  const canPropose = changed && errors.length === 0 && rationale.trim().length > 0 && !pending;
  const id = `propose-${caseView._id}`;

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await propose({ caseId: caseView._id, afterSpec, rationale: rationale.trim(), commercialImpact: impact });
      toast.success("Proposed. The client compares the two designs and decides; nothing changes until they accept.");
      setPatch({});
      setRationale("");
      setImpact("none");
    } catch (caught) {
      setError(toClientError(caught).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-base font-medium">Propose a change</h3>
        <Mono>against revision {baseRevision}</Mono>
      </div>
      <SpecFields
        spec={afterSpec}
        catalogue={catalogue}
        idPrefix={id}
        onPatch={(next) => setPatch((previous) => mergePatch(previous, next))}
      />

      {conflicts.length > 0 ? (
        <div className="space-y-1 text-sm">
          <p className="font-medium">The tailoring rules also changed</p>
          <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
            {conflicts.map((conflict) => (
              <li key={conflict.field}>
                {conflict.label}: {conflict.from} → {conflict.to}. {conflict.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {errors.length > 0 ? (
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-destructive" role="alert">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground">What the client will compare</p>
        {changed ? (
          <ChangesList changes={changes} />
        ) : (
          <p className="text-sm text-muted-foreground">
            No change yet. Adjust a field above; the client&rsquo;s design is untouched until they accept.
          </p>
        )}
      </div>

      <Field>
        <FieldLabel htmlFor={`${id}-why`}>Why</FieldLabel>
        <FieldDescription>Shown to the client word for word, signed with your first name.</FieldDescription>
        <Textarea id={`${id}-why`} value={rationale} onChange={(event) => setRationale(event.target.value)} rows={3} />
      </Field>

      <div className="space-y-2">
        <p id={`${id}-impact-label`} className="text-sm font-medium">
          Commercial impact
        </p>
        <ChoiceList
          value={impact}
          onValueChange={(value) => setImpact(COMMERCIAL_IMPACTS.find((entry) => entry === value) ?? "none")}
          aria-labelledby={`${id}-impact-label`}
        >
          {COMMERCIAL_IMPACTS.map((entry) => (
            <ChoiceRow
              key={entry}
              id={`${id}-impact-${entry}`}
              value={entry}
              title={COMMERCIAL_IMPACT_WORDS[entry].label}
              description={COMMERCIAL_IMPACT_WORDS[entry].description}
            />
          ))}
        </ChoiceList>
      </div>

      {error ? <ErrorAlert title="The proposal was not sent" message={error} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button className="h-10 rounded-none px-5" disabled={!canPropose} onClick={() => void submit()}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          Propose to the client
        </Button>
        <Button variant="ghost" className="h-10" disabled={pending || !changed} onClick={() => setPatch({})}>
          Start again from the current design
        </Button>
      </div>
    </div>
  );
}
