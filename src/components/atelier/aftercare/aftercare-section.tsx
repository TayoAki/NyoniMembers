"use client";

import { forwardRef } from "react";
import {
  AFTERCARE_KINDS,
  isAftercareKind,
  type CorrectionIntent,
} from "@/components/atelier/aftercare/aftercare-words";
import { CorrectionForm } from "@/components/atelier/aftercare/correction-form";
import { CorrectionItem } from "@/components/atelier/aftercare/correction-item";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { isInHand } from "@/components/atelier/orders/order-words";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { CorrectionSummary } from "@convex/atelier/corrections";
import type { OrderView } from "@convex/atelier/orders";
import { HOUSE_POLICY } from "@convex/shared/atelier/policy";

type Props = {
  order: OrderView;
  corrections: CorrectionSummary[] | undefined;
  intent: CorrectionIntent | null;
  onOpenForm: (kind: "alteration") => void;
  onCloseForm: () => void;
};

/**
 * S31 (C24): the corrections raised on this commission, each with its truthful status and detail, and
 * the request for an alteration or a remake. A fit or detail issue can be raised only with the suit in
 * hand; before that, the conversation on the request is the place to write.
 */
export const AftercareSection = forwardRef<HTMLDivElement, Props>(function AftercareSection(
  { order, corrections, intent, onOpenForm, onCloseForm },
  ref,
) {
  const inHand = isInHand(order.status);
  const formHere = intent !== null && isAftercareKind(intent.kind);
  const cancelled = order.status === "cancelled";
  return (
    <div ref={ref} className="scroll-mt-24">
      <AtelierSection
        id="aftercare"
        title="Aftercare"
        description={`${HOUSE_POLICY.verified.alterations} An alteration or a remake starts here; the house proposes the remedy and nothing proceeds until you accept it.`}
        actions={
          inHand && !formHere ? (
            <Button variant="outline" className="h-11 rounded-none px-5" onClick={() => onOpenForm("alteration")}>
              Request an alteration
            </Button>
          ) : undefined
        }
      >
        <div className="space-y-6">
          {!inHand && !cancelled ? (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              A fit or detail issue can be raised once the suit is with you. For anything before delivery, write to your
              concierge on your request.
            </p>
          ) : null}

          {corrections === undefined ? (
            <div className="space-y-3" aria-busy="true" aria-label="Loading corrections">
              <Skeleton className="h-5 w-64 max-w-full" />
              <Skeleton className="h-3 w-48 max-w-full" />
            </div>
          ) : corrections.length === 0 ? (
            inHand && !formHere ? (
              <p className="text-sm leading-relaxed text-muted-foreground">
                No correction has been asked for on this suit.
              </p>
            ) : null
          ) : (
            <ul
              className="divide-y divide-foreground/10 border-y border-foreground/15"
              aria-label="Corrections on this commission"
            >
              {corrections.map((summary) => (
                <CorrectionItem key={summary._id} summary={summary} />
              ))}
            </ul>
          )}

          {formHere && intent ? (
            <CorrectionForm
              key={intent.key}
              order={order}
              kinds={AFTERCARE_KINDS}
              initialKind={intent.kind}
              initialRegion={intent.region}
              onCancel={onCloseForm}
            />
          ) : null}
        </div>
      </AtelierSection>
    </div>
  );
});
