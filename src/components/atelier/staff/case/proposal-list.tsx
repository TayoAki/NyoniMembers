"use client";

import { useMutation } from "convex/react";
import { toast } from "sonner";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { api } from "@convex/_generated/api";
import type { ProposalView, StaffCaseView } from "@convex/atelier/cases";
import { COMMERCIAL_IMPACT_WORDS, PROPOSAL_STATUS_TONES } from "./case-words";
import { ProposalComposer } from "./proposal-composer";

/** C20 from the house's side: the proposals made on this request, newest first, and the composer for a new one. */
export function ProposalsSection({ caseView }: { caseView: StaffCaseView }) {
  const proposals = [...caseView.proposals].sort((a, b) => b.createdAt - a.createdAt);
  return (
    <AtelierSection
      id="proposals"
      title="Proposed changes"
      description="A proposal is pinned to the client's current design. Nothing changes until they accept; a change that carries a price supersedes the offered quote."
    >
      <div className="space-y-8">
        {proposals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No proposals on this request.</p>
        ) : (
          <ol className="divide-y divide-foreground/10 border-y border-foreground/15">
            {proposals.map((proposal) => (
              <ProposalRow key={proposal._id} proposal={proposal} />
            ))}
          </ol>
        )}
        {caseView.open && caseView.draft ? <ProposalComposer caseView={caseView} /> : null}
      </div>
    </AtelierSection>
  );
}

function ProposalRow({ proposal }: { proposal: ProposalView }) {
  const withdraw = useMutation(api.atelier.cases.withdrawProposal);
  return (
    <li className="space-y-3 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <StatusLine tone={PROPOSAL_STATUS_TONES[proposal.status]}>{proposal.statusLabel}</StatusLine>
          <Mono>against revision {proposal.baseRevision}</Mono>
        </div>
        <Mono upper={false} className="text-[11px]">
          {formatDateTime(proposal.createdAt)}
          {proposal.decidedAt !== null ? ` · decided ${formatDateTime(proposal.decidedAt)}` : ""}
        </Mono>
      </div>
      {proposal.stale && proposal.status === "proposed" ? (
        <p className="text-sm text-warning">
          The design moved on after this was proposed; the client can read it but no longer accept it. Propose again
          from the current design.
        </p>
      ) : null}
      <p className="text-sm leading-relaxed">{proposal.rationale}</p>
      <p className="text-xs text-muted-foreground">{COMMERCIAL_IMPACT_WORDS[proposal.commercialImpact].label}.</p>
      <ChangesList changes={proposal.changes} />
      {proposal.status === "proposed" ? (
        <ConfirmDialog
          title="Withdraw this proposal?"
          description="The client can no longer accept it. Their design is unchanged either way."
          confirmLabel="Withdraw"
          onConfirm={async () => {
            await withdraw({ proposalId: proposal._id });
            toast.success("Withdrawn.");
          }}
          trigger={
            <Button variant="outline" size="sm" className="h-8">
              Withdraw
            </Button>
          }
        />
      ) : null}
    </li>
  );
}

export function ChangesList({ changes }: { changes: ProposalView["changes"] }) {
  if (changes.length === 0) return <p className="text-sm text-muted-foreground">No lines differ.</p>;
  return (
    <dl className="divide-y divide-foreground/10 border-y border-foreground/15 text-sm">
      {changes.map((change) => (
        <div
          key={`${change.section}:${change.label}`}
          className="grid gap-x-6 gap-y-1 py-2 sm:grid-cols-[minmax(7rem,11rem)_1fr]"
        >
          <dt className="text-xs font-medium tracking-wide text-muted-foreground">
            {change.section} · {change.label}
          </dt>
          <dd className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-muted-foreground line-through decoration-foreground/40">{change.from}</span>
            {change.fromProductionId ? <Mono>{change.fromProductionId}</Mono> : null}
            <span aria-hidden>→</span>
            <span className="font-medium">{change.to}</span>
            {change.toProductionId ? <Mono>{change.toProductionId}</Mono> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
