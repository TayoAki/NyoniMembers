"use client";

import { useMutation } from "convex/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Mono } from "@/components/atelier/common/mono";
import { OrderBook, OrderBookRow } from "@/components/atelier/common/order-book";
import { StatusLine } from "@/components/atelier/common/status-line";
import {
  impactWords,
  lineKey,
  PROPOSAL_TONES,
  STALE_PROPOSAL_SENTENCE,
} from "@/components/atelier/requests/case-words";
import { DescribedLinesBook } from "@/components/atelier/requests/described-lines";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useGuestKeyArg } from "@/hooks/atelier/use-owner-args";
import { toClientError, type ClientError } from "@/lib/errors";
import { formatDate, pluralize } from "@/lib/format";
import { api } from "@convex/_generated/api";
import type { CaseView, ProposalView } from "@convex/atelier/cases";
import { describeSpec, type DescribedLine } from "@convex/shared/atelier/spec";

/**
 * S26 (C20): one proposed change. The changed lines are shown before → after; everything else is
 * collapsed as unchanged. Accept writes a new revision; decline keeps the design. A proposal pinned to
 * an earlier revision can be read but not answered.
 */
export function ProposalItem({ proposal, request }: { proposal: ProposalView; request: CaseView }) {
  const guestKeyArg = useGuestKeyArg();
  const respond = useMutation(api.atelier.cases.respondToProposal);
  const [error, setError] = useState<ClientError | null>(null);
  const [opened, setOpened] = useState(false);

  const unchanged = useMemo<DescribedLine[]>(() => {
    const changed = new Set(proposal.changes.map(lineKey));
    const submitted =
      request.revision && request.revision.revision === proposal.baseRevision ? request.revision.lines : null;
    const source = submitted ?? describeSpec(proposal.afterSpec);
    return source.filter((line) => !changed.has(lineKey(line)));
  }, [proposal.afterSpec, proposal.baseRevision, proposal.changes, request.revision]);

  const answerable = proposal.status === "proposed" && !proposal.stale && request.open;

  async function answer(accept: boolean) {
    setError(null);
    try {
      await respond({ ...guestKeyArg, proposalId: proposal._id, accept });
      toast.success(accept ? "Change accepted · your design is updated" : "Change declined · your design is unchanged");
    } catch (caught) {
      const clientError = toClientError(caught);
      const message = clientError.code === "STALE_REVISION" ? STALE_PROPOSAL_SENTENCE : clientError.message;
      toast.error(message);
      setError({ ...clientError, message });
    }
  }

  return (
    <li id={`proposal-${proposal._id}`} className="scroll-mt-24 space-y-4 py-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <h3 className="text-base font-medium">
          Proposed {formatDate(proposal.createdAt)}{" "}
          <span className="text-muted-foreground">· against revision {proposal.baseRevision}</span>
        </h3>
        <StatusLine tone={PROPOSAL_TONES[proposal.status]}>
          {proposal.statusLabel}
          {proposal.decidedAt && proposal.status !== "proposed" ? ` · ${formatDate(proposal.decidedAt)}` : ""}
        </StatusLine>
      </div>

      <p className="max-w-2xl text-sm leading-relaxed text-pretty">{proposal.rationale}</p>

      <OrderBook aria-label="What would change">
        {proposal.changes.map((change) => (
          <OrderBookRow
            key={lineKey(change)}
            label={
              <>
                {change.section} <span aria-hidden>·</span> {change.label}
              </>
            }
            value={
              <>
                <span className="text-muted-foreground">{change.from}</span>{" "}
                <span className="text-muted-foreground" aria-hidden>
                  →
                </span>
                <span className="sr-only">becomes</span> <span className="font-medium">{change.to}</span>
              </>
            }
            code={change.toProductionId}
            note={
              change.fromProductionId ? (
                <>
                  was <Mono>{change.fromProductionId}</Mono>
                </>
              ) : null
            }
          />
        ))}
      </OrderBook>

      {unchanged.length > 0 ? (
        <Collapsible open={opened} onOpenChange={setOpened}>
          <CollapsibleTrigger
            render={
              <Button variant="ghost" className="h-11 rounded-none px-3 text-muted-foreground hover:text-foreground" />
            }
          >
            {opened ? "Hide" : "Show"} the {pluralize(unchanged.length, "line")} that stay as submitted
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <DescribedLinesBook lines={unchanged} aria-label="Lines that stay as submitted" />
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      <p className="text-sm text-muted-foreground">{impactWords(proposal.commercialImpact)}</p>

      {proposal.stale && proposal.status === "proposed" ? (
        <p className="text-sm text-warning">{STALE_PROPOSAL_SENTENCE}</p>
      ) : null}
      {proposal.status === "proposed" && !request.open ? (
        <p className="text-sm text-muted-foreground">
          This request is {request.statusLabel.toLowerCase()}; the proposal can no longer be answered.
        </p>
      ) : null}

      {error ? <ErrorAlert title="Your answer was not recorded" message={error.message} /> : null}

      {answerable ? (
        <div className="flex flex-wrap items-center gap-3">
          <ConfirmDialog
            trigger={<Button className="h-11 rounded-none px-5">Accept this change</Button>}
            title="Accept the proposed change?"
            description={`Your design is updated to the lines above and becomes a new revision; the submitted design stays on record. ${impactWords(proposal.commercialImpact)}`}
            confirmLabel="Accept the change"
            cancelLabel="Not yet"
            onConfirm={() => answer(true)}
          />
          <ConfirmDialog
            trigger={
              <Button variant="outline" className="h-11 rounded-none px-5">
                Decline
              </Button>
            }
            title="Decline the proposed change?"
            description="Your design stays exactly as submitted. Your concierge is told and can propose something else."
            confirmLabel="Decline the change"
            cancelLabel="Keep thinking"
            onConfirm={() => answer(false)}
          />
        </div>
      ) : null}
    </li>
  );
}
