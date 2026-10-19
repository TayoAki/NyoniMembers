"use client";

import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { ProposalItem } from "@/components/atelier/requests/proposal-item";
import type { CaseView } from "@convex/atelier/cases";

/** S26: every change the house has proposed on this request, the ones awaiting an answer first. */
export function Proposals({ request }: { request: CaseView }) {
  if (request.proposals.length === 0) return null;
  const proposals = [...request.proposals].sort(
    (a, b) => Number(a.status !== "proposed") - Number(b.status !== "proposed") || b.createdAt - a.createdAt,
  );
  const pending = proposals.filter((proposal) => proposal.status === "proposed" && !proposal.stale).length;
  return (
    <AtelierSection
      id="proposals"
      title={pending > 0 ? "A change is proposed" : "Proposed changes"}
      description="Your concierge may propose a change to the design. Nothing changes until you accept it; declining keeps your design exactly as submitted."
    >
      <ol className="divide-y divide-foreground/10 border-y border-foreground/15" aria-label="Proposed changes">
        {proposals.map((proposal) => (
          <ProposalItem key={proposal._id} proposal={proposal} request={request} />
        ))}
      </ol>
    </AtelierSection>
  );
}
