"use client";

import { useQuery } from "convex/react";
import { notFound } from "next/navigation";
import { CaseDetails } from "@/components/atelier/requests/case-details";
import { CaseSkeleton } from "@/components/atelier/requests/case-skeleton";
import { Conversation } from "@/components/atelier/requests/conversation";
import { PaymentState } from "@/components/atelier/requests/payment-state";
import { Proposals } from "@/components/atelier/requests/proposals";
import { QuoteSection } from "@/components/atelier/requests/quote-section";
import { ReceiptHeader } from "@/components/atelier/requests/receipt-header";
import { SubmittedDesign } from "@/components/atelier/requests/submitted-design";
import { useOwnerArgs } from "@/hooks/atelier/use-owner-args";
import { api } from "@convex/_generated/api";
import type { CaseView } from "@convex/atelier/cases";

/**
 * S25–S28 (C19–C21): one request. The receipt, then what waits on the client (proposals, the quote),
 * the payment state once a commission exists, the conversation, the frozen submitted design and the
 * details given. Unknown, malformed or someone else's ids are not found.
 */
export function CasePage({ caseId }: { caseId: string }) {
  const request = useQuery(api.atelier.cases.get, useOwnerArgs({ caseId }));
  if (request === undefined) return <CaseSkeleton />;
  if (request === null) notFound();
  return <CaseDetail request={request} />;
}

function CaseDetail({ request }: { request: CaseView }) {
  return (
    <div className="space-y-8 pt-6">
      <ReceiptHeader request={request} />
      <Proposals request={request} />
      <QuoteSection request={request} />
      {request.orderId ? <PaymentState orderId={request.orderId} /> : null}
      <Conversation request={request} />
      <SubmittedDesign request={request} />
      <CaseDetails request={request} />
    </div>
  );
}
