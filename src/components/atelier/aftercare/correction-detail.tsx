"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  awaitsReassessment,
  CANCELLED_SENTENCE,
  DETAIL_MISMATCH_SENTENCE,
  ESCALATED_SENTENCE,
  HOUSE_REVIEW_SENTENCE,
  reassessmentWords,
  REFUND_TONES,
  REFUND_TRUTH,
  SPEC_UNCHANGED_SENTENCE,
} from "@/components/atelier/aftercare/aftercare-words";
import { ReassessForm } from "@/components/atelier/aftercare/reassess-form";
import { Mono } from "@/components/atelier/common/mono";
import { OrderBook, OrderBookRow } from "@/components/atelier/common/order-book";
import { StatusLine } from "@/components/atelier/common/status-line";
import { ESTIMATE_WORD } from "@/components/atelier/orders/order-words";
import { DescribedLinesBook } from "@/components/atelier/requests/described-lines";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ErrorAlert } from "@/components/common/error-alert";
import { ItemImage } from "@/components/common/item-image";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { useGuestKeyArg, useOwnerArgs } from "@/hooks/atelier/use-owner-args";
import { toClientError, type ClientError } from "@/lib/errors";
import { formatDate, formatDateTime, formatUsd } from "@/lib/format";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { CorrectionView } from "@convex/atelier/corrections";

/**
 * S31 (C24, C25; scenario 11): one correction in full. The issue as described, the house's proposed
 * remedy to accept, the reassessment once the work is done, any refund in the recorded words, and the
 * specification and fit profile the suit was cut to, inspectable beside it.
 */
export function CorrectionDetail({ correctionId }: { correctionId: Id<"atelierCorrections"> }) {
  const correction = useQuery(api.atelier.corrections.get, useOwnerArgs({ correctionId }));
  if (correction === undefined) {
    return (
      <div className="space-y-3 pt-3" aria-busy="true" aria-label="Loading the correction">
        <Skeleton className="h-4 w-full max-w-xl" />
        <Skeleton className="h-4 w-72 max-w-full" />
        <Skeleton className="h-11 w-40 rounded-none" />
      </div>
    );
  }
  if (correction === null) {
    return (
      <p className="pt-3 text-sm leading-relaxed text-muted-foreground">
        This correction is not available to this browser or account. Sign in with the account that raised it to read it.
      </p>
    );
  }
  return <CorrectionBody correction={correction} />;
}

function CorrectionBody({ correction }: { correction: CorrectionView }) {
  const [specOpen, setSpecOpen] = useState(false);
  return (
    <div className="space-y-5 pt-3">
      <p className="max-w-2xl text-sm leading-relaxed whitespace-pre-line">{correction.description}</p>

      {correction.photoUrls.length > 0 ? (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6" aria-label="Your photographs">
          {correction.photoUrls.map((url, index) => (
            <li key={url}>
              <ItemImage
                src={url}
                alt={`Photograph ${index + 1} you sent with this correction`}
                variant="photo"
                aspect="aspect-square"
                className="rounded-none"
              />
            </li>
          ))}
        </ul>
      ) : null}

      {correction.isDetailMismatch ? (
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{DETAIL_MISMATCH_SENTENCE}</p>
      ) : null}
      {correction.kind === "cancellation" && correction.order.status === "cancelled" ? (
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{CANCELLED_SENTENCE}</p>
      ) : correction.kind === "cancellation" && correction.requiresHouseReview && correction.open ? (
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{HOUSE_REVIEW_SENTENCE}</p>
      ) : null}
      {correction.status === "escalated" ? (
        <p className="max-w-2xl text-sm leading-relaxed text-warning">
          {ESCALATED_SENTENCE}
          {correction.escalatedAt !== null ? ` Escalated ${formatDate(correction.escalatedAt)}.` : ""}
        </p>
      ) : null}

      {correction.remedy ? <RemedyPanel correction={correction} /> : null}

      {awaitsReassessment(correction) ? <ReassessForm correctionId={correction._id} /> : null}
      {correction.reassessment ? (
        <p className="max-w-2xl text-sm leading-relaxed">
          <span className="font-medium">
            Reassessed {formatDate(correction.reassessment.at)}: {reassessmentWords(correction.reassessment)}.
          </span>{" "}
          <span className="text-muted-foreground">{correction.reassessment.note}</span>
        </p>
      ) : null}

      {correction.refund ? (
        <div className="space-y-2 border-t border-foreground/15 pt-4">
          <StatusLine tone={REFUND_TONES[correction.refund.state]} className="text-sm">
            {correction.refund.stateLabel}
            {correction.refund.amountUsd !== null ? ` · ${formatUsd(correction.refund.amountUsd)}` : ""}
          </StatusLine>
          {correction.refund.confirmedAt !== null || correction.refund.reference ? (
            <p className="text-xs text-muted-foreground">
              {correction.refund.confirmedAt !== null
                ? `Recorded ${formatDateTime(correction.refund.confirmedAt)}`
                : null}
              {correction.refund.reference ? (
                <>
                  {correction.refund.confirmedAt !== null ? " · " : ""}reference{" "}
                  <Mono upper={false}>{correction.refund.reference}</Mono>
                </>
              ) : null}
            </p>
          ) : null}
          <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">{REFUND_TRUTH}</p>
        </div>
      ) : null}

      <div className="space-y-3 border-t border-foreground/15 pt-4">
        <OrderBook aria-label="What this suit was cut to">
          <OrderBookRow
            label="Fit profile"
            value={
              correction.fitProfileVersionBefore !== null
                ? `Version ${correction.fitProfileVersionBefore} when the suit was cut`
                : correction.order.fitProfileVersion !== null
                  ? `Version ${correction.order.fitProfileVersion}`
                  : "No numbered fit profile is attached to this commission"
            }
            note={
              correction.fitProfileVersionAfter !== null
                ? `Your approved profile after this correction: version ${correction.fitProfileVersionAfter}. ${SPEC_UNCHANGED_SENTENCE}`
                : SPEC_UNCHANGED_SENTENCE
            }
          />
          <OrderBookRow
            label="Specification"
            value={correction.order.summary}
            code={correction.order.specHash.slice(0, 12)}
          />
        </OrderBook>
        <Collapsible open={specOpen} onOpenChange={setSpecOpen}>
          <CollapsibleTrigger
            render={
              <Button variant="ghost" className="h-11 rounded-none px-3 text-muted-foreground hover:text-foreground" />
            }
          >
            {specOpen ? "Hide" : "Show"} the specification this suit was cut to
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <DescribedLinesBook lines={correction.order.lines} aria-label="The specification this suit was cut to" />
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <Link
          href={routes.atelier.request(correction.caseId)}
          className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
        >
          Open the conversation on this correction
        </Link>
        <span>
          Request <Mono upper={false}>{correction.caseId}</Mono>
        </span>
      </div>
    </div>
  );
}

/** The house's proposed remedy and its acceptance; nothing proceeds until the client accepts. */
function RemedyPanel({ correction }: { correction: CorrectionView }) {
  const remedy = correction.remedy;
  const guestKeyArg = useGuestKeyArg();
  const acceptRemedy = useMutation(api.atelier.corrections.acceptRemedy);
  const [error, setError] = useState<ClientError | null>(null);
  if (!remedy) return null;
  const proposed = correction.status === "remedy_proposed";

  async function accept() {
    setError(null);
    try {
      await acceptRemedy({ ...guestKeyArg, correctionId: correction._id });
      toast.success("Remedy accepted · the house takes it from here");
    } catch (caught) {
      setError(toClientError(caught));
      throw caught;
    }
  }

  return (
    <div className="space-y-4 border-t border-foreground/15 pt-4">
      <h4 className="text-base font-medium">{proposed ? "The house proposes" : "The remedy"}</h4>
      <OrderBook aria-label="Proposed remedy">
        <OrderBookRow label="Remedy" value={remedy.kindLabel} />
        <OrderBookRow
          label="Coverage"
          value={
            <>
              {remedy.coverageLabel}
              {remedy.amountUsd !== null && remedy.amountUsd > 0 ? ` · ${formatUsd(remedy.amountUsd)}` : ""}
            </>
          }
        />
        <OrderBookRow label="How it works" value={<span className="whitespace-pre-line">{remedy.logistics}</span>} />
        {remedy.deadline !== null ? (
          <OrderBookRow
            label="Target"
            value={
              <>
                {formatDate(remedy.deadline)} <Mono>{ESTIMATE_WORD}</Mono>
              </>
            }
            note="A date the house set for itself, not a promise."
          />
        ) : null}
        {remedy.approvedBy ? <OrderBookRow label="Approved by" value={remedy.approvedBy} /> : null}
      </OrderBook>
      {error ? (
        <ErrorAlert title="The remedy was not accepted" message={error.message} className="rounded-none" />
      ) : null}
      {proposed ? (
        <div className="flex flex-wrap items-center gap-3">
          <ConfirmDialog
            trigger={<Button className="h-11 rounded-none px-5">Accept this remedy</Button>}
            title="Accept the proposed remedy?"
            description={`${remedy.kindLabel} · ${remedy.coverageLabel}. ${remedy.logistics}`}
            confirmLabel="Accept the remedy"
            cancelLabel="Not yet"
            onConfirm={accept}
          >
            <p className="text-sm leading-relaxed text-muted-foreground">
              Nothing proceeds until you accept. Once you do, the house starts the work and asks you to reassess the fit
              when it is done.
            </p>
          </ConfirmDialog>
          <Button
            variant="ghost"
            className="h-11 rounded-none px-4 text-muted-foreground hover:text-foreground"
            render={<Link href={routes.atelier.request(correction.caseId)} />}
            nativeButton={false}
          >
            Ask a question first
          </Button>
        </div>
      ) : null}
    </div>
  );
}
