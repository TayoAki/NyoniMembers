"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { OrderBook, OrderBookRow } from "@/components/atelier/common/order-book";
import { StatusLine } from "@/components/atelier/common/status-line";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toClientError } from "@/lib/errors";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { StaffCaseView } from "@convex/atelier/cases";
import type { SampleState } from "@convex/shared/atelier/enums";
import { nextSampleStates, SAMPLE_STATE_LABELS, SAMPLE_STATE_TONES } from "./case-words";

type Sample = NonNullable<StaffCaseView["sample"]>;

/**
 * C04 fulfilment: requested → accepted → shipped, or declined. Each step writes a message the client reads;
 * "Shipped" is recorded only once the sample has left the house. The address is shown here because the
 * house needs it; it never appears in any client-facing list.
 */
export function SamplePanel({
  caseId,
  sample,
  open,
  clientFirstName,
}: {
  caseId: Id<"atelierCases">;
  sample: Sample;
  open: boolean;
  clientFirstName: string;
}) {
  const markSample = useMutation(api.atelier.cases.markSample);
  const [pending, setPending] = useState<SampleState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const next = nextSampleStates(sample.state);
  const address = sample.address;

  async function mark(state: SampleState) {
    setPending(state);
    setError(null);
    try {
      await markSample({ caseId, state });
      toast.success(`Recorded: ${SAMPLE_STATE_LABELS[state]}. ${clientFirstName} reads it under their request.`);
    } catch (caught) {
      setError(toClientError(caught).message);
    } finally {
      setPending(null);
    }
  }

  return (
    <AtelierSection
      id="sample"
      title="Cloth sample"
      description="Requested, accepted and shipped are distinct words for the client. Record each step only when it is true."
    >
      <OrderBook>
        <OrderBookRow label="Cloth" value={sample.clothName ?? sample.clothCode} code={sample.clothCode} />
        <OrderBookRow
          label="State"
          value={<StatusLine tone={SAMPLE_STATE_TONES[sample.state]}>{sample.stateLabel}</StatusLine>}
        />
        <OrderBookRow
          label="Ship to"
          value={
            <span className="flex flex-col">
              <span>{address.line1}</span>
              {address.line2 ? <span>{address.line2}</span> : null}
              <span>
                {address.city}, {address.region} {address.postalCode}
              </span>
              <span>{address.country}</span>
            </span>
          }
        />
      </OrderBook>
      {open && next.length > 0 ? (
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {next.map((state) => (
              <Button
                key={state}
                variant={state === "declined" ? "destructive" : "outline"}
                className="h-10 rounded-none px-4"
                disabled={pending !== null}
                onClick={() => void mark(state)}
              >
                {pending === state ? <Spinner data-icon="inline-start" /> : null}
                {SAMPLE_STATE_LABELS[state]}
              </Button>
            ))}
          </div>
          {error ? <ErrorAlert title="The sample step was not recorded" message={error} /> : null}
        </div>
      ) : null}
    </AtelierSection>
  );
}
