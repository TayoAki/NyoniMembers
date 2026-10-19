"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { Mono } from "@/components/atelier/common/mono";
import { OrderBook, OrderBookRow } from "@/components/atelier/common/order-book";
import { StatusLine } from "@/components/atelier/common/status-line";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toClientError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { api } from "@convex/_generated/api";
import type { StaffOrderView } from "@convex/atelier/orders";
import { ORDER_STATUS_LABELS } from "@convex/shared/atelier/enums";

/**
 * O05 steps 1 and 2: preflight and release. The blockers come with the view and can be re-run on demand;
 * Release stays disabled while any remain and needs the maker's reference. Release is the one
 * irreversible act on this desk, so it confirms first and says what the client will read.
 */
export function ReleasePanel({ order }: { order: StaffOrderView }) {
  const [checking, setChecking] = useState(false);
  const preflight = useQuery(api.atelier.orders.preflight, checking ? { orderId: order._id } : "skip");
  const blockers = preflight?.blockers ?? order.blockers;

  if (order.status === "cancelled") {
    return <p className="text-sm text-muted-foreground">This commission was cancelled; nothing goes to the cutter.</p>;
  }
  if (order.status !== "preflight") {
    return (
      <OrderBook>
        <OrderBookRow
          label="Released"
          value={order.releasedAt !== null ? formatDateTime(order.releasedAt) : "Yes"}
          note={
            order.releasedBy
              ? `By ${order.releasedBy}. The specification below is immutable; a change is a new proposal on the request.`
              : "The specification below is immutable; a change is a new proposal on the request."
          }
        />
        <OrderBookRow
          label="Maker reference"
          value={order.makerRef ? <Mono upper={false}>{order.makerRef}</Mono> : "Not recorded"}
          tone={order.makerRef ? "default" : "muted"}
        />
      </OrderBook>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StatusLine tone={blockers.length === 0 ? "success" : "warning"} live>
            {blockers.length === 0
              ? "Nothing blocks release"
              : `${blockers.length === 1 ? "One thing blocks" : `${blockers.length} things block`} release`}
          </StatusLine>
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => setChecking(true)}
            disabled={checking && preflight === undefined}
          >
            {checking && preflight === undefined ? "Checking…" : checking ? "Checked just now" : "Run preflight again"}
          </Button>
        </div>
        {blockers.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-warning">
            {blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Quote accepted, design unchanged since, fit recorded and payment as policy requires. Release sends the exact
            production ids below.
          </p>
        )}
      </div>
      <ReleaseForm order={order} blocked={blockers.length > 0} />
    </div>
  );
}

function ReleaseForm({ order, blocked }: { order: StaffOrderView; blocked: boolean }) {
  const release = useMutation(api.atelier.orders.release);
  const [makerRef, setMakerRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorBlockers, setErrorBlockers] = useState<string[]>([]);
  const ref = makerRef.trim();

  async function confirm() {
    setError(null);
    setErrorBlockers([]);
    try {
      await release({ orderId: order._id, makerRef: ref });
      toast.success(`Released. The client now reads “${ORDER_STATUS_LABELS.released}”.`);
      setMakerRef("");
    } catch (caught) {
      const client = toClientError(caught);
      setError(client.message);
      const details = client.details?.blockers;
      if (Array.isArray(details))
        setErrorBlockers(details.filter((entry): entry is string => typeof entry === "string"));
      throw caught;
    }
  }

  return (
    <div className="space-y-4">
      <Field>
        <FieldLabel htmlFor={`maker-ref-${order._id}`}>Maker&rsquo;s reference</FieldLabel>
        <FieldDescription>
          The cutter&rsquo;s own job number for this package. Required; recorded on the release.
        </FieldDescription>
        <Input
          id={`maker-ref-${order._id}`}
          value={makerRef}
          onChange={(event) => setMakerRef(event.target.value)}
          placeholder="NC-2026-0142"
          className="max-w-xs rounded-sm"
        />
      </Field>
      {error ? (
        <ErrorAlert
          title="The commission was not released"
          message={
            errorBlockers.length > 0 ? (
              <ul className="list-disc pl-5">
                {errorBlockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            ) : (
              error
            )
          }
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <ConfirmDialog
          trigger={
            <Button disabled={blocked || ref.length === 0} className="h-10 rounded-none px-4">
              Release to the cutter
            </Button>
          }
          title="Release this commission?"
          description={`The specification and production ids below go to the maker under reference ${ref || "—"} and cannot change afterwards. The client reads “${ORDER_STATUS_LABELS.released}”.`}
          confirmLabel="Release"
          onConfirm={confirm}
        />
        <p className="text-xs text-muted-foreground">
          Client reads: <span className="text-foreground">“{ORDER_STATUS_LABELS.released}”</span>
          {blocked ? " · disabled while anything blocks release" : ""}
        </p>
      </div>
    </div>
  );
}
