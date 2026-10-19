"use client";

import { forwardRef } from "react";
import {
  cancellationNote,
  COMMERCE_KINDS,
  correctionTitle,
  KIND_ACTIONS,
  KIND_NOTES,
  REFUND_TRUTH,
  type CorrectionIntent,
} from "@/components/atelier/aftercare/aftercare-words";
import { CorrectionForm } from "@/components/atelier/aftercare/correction-form";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { OrderBook, OrderBookRow } from "@/components/atelier/common/order-book";
import { isInHand } from "@/components/atelier/orders/order-words";
import { Button } from "@/components/ui/button";
import type { CorrectionSummary } from "@convex/atelier/corrections";
import type { OrderView } from "@convex/atelier/orders";
import { CORRECTION_KIND_LABELS, type CorrectionKind } from "@convex/shared/atelier/enums";
import { HOUSE_POLICY } from "@convex/shared/atelier/policy";

type Props = {
  order: OrderView;
  corrections: CorrectionSummary[] | undefined;
  intent: CorrectionIntent | null;
  onOpenForm: (kind: CorrectionKind) => void;
  onCloseForm: () => void;
};

/** Which of the policy section's requests this commission can make right now, and why not otherwise. */
function availability(order: OrderView, kind: CorrectionKind): { note: string; disabledReason: string | null } {
  if (order.status === "cancelled") return { note: KIND_NOTES[kind], disabledReason: "This commission was cancelled." };
  if (kind === "cancellation") return { note: cancellationNote(order), disabledReason: null };
  return {
    note: KIND_NOTES[kind],
    disabledReason: isInHand(order.status) ? null : "Available once the suit is with you.",
  };
}

/**
 * S32 (C25): what the house's published policy allows, shown before any request is collected, then the
 * requests this commission can make, each in words that promise nothing. A cancellation after release
 * is reviewed by the house; a refund approved is not a refund returned.
 */
export const PolicySection = forwardRef<HTMLDivElement, Props>(function PolicySection(
  { order, corrections, intent, onOpenForm, onCloseForm },
  ref,
) {
  const formHere = intent !== null && COMMERCE_KINDS.includes(intent.kind);
  const refunds = (corrections ?? []).filter((summary) => summary.refundStateLabel !== null);
  return (
    <div ref={ref} className="scroll-mt-24">
      <AtelierSection
        id="cancellation"
        title="Cancellation, return, exchange and refund"
        description="What the house's published policy allows, before any request. Your concierge tells you what applies to this commission; nothing here is decided by a form."
      >
        <div className="space-y-8">
          <OrderBook aria-label="The house's published policy">
            <OrderBookRow label="Final sale" value={HOUSE_POLICY.verified.finalSale} />
            <OrderBookRow label="Refunds and exchanges" value={HOUSE_POLICY.verified.refunds} />
            <OrderBookRow label="Store credit" value={HOUSE_POLICY.verified.storeCredit} />
          </OrderBook>

          <div className="space-y-3">
            <h3 className="text-base font-medium">What you can ask for on this commission</h3>
            <ul
              className="divide-y divide-foreground/10 border-y border-foreground/15"
              aria-label="Requests you can make"
            >
              {COMMERCE_KINDS.map((kind) => {
                const { note, disabledReason } = availability(order, kind);
                return (
                  <li key={kind} className="grid gap-x-6 gap-y-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium">{CORRECTION_KIND_LABELS[kind]}</p>
                      <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">{note}</p>
                      {disabledReason ? <p className="text-xs leading-relaxed text-warning">{disabledReason}</p> : null}
                    </div>
                    <Button
                      variant="outline"
                      className="h-11 rounded-none px-4 sm:justify-self-end"
                      onClick={() => onOpenForm(kind)}
                      disabled={disabledReason !== null || (formHere && intent?.kind === kind)}
                    >
                      {KIND_ACTIONS[kind]}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>

          {refunds.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-base font-medium">Refunds on this commission</h3>
              <OrderBook aria-label="Refund state">
                {refunds.map((summary) => (
                  <OrderBookRow
                    key={summary._id}
                    label={correctionTitle(summary)}
                    value={summary.refundStateLabel}
                    code={summary._id}
                  />
                ))}
              </OrderBook>
              <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">{REFUND_TRUTH}</p>
            </div>
          ) : null}

          {formHere && intent ? (
            <CorrectionForm
              key={intent.key}
              order={order}
              kinds={[intent.kind]}
              initialKind={intent.kind}
              onCancel={onCloseForm}
            />
          ) : null}
        </div>
      </AtelierSection>
    </div>
  );
});
