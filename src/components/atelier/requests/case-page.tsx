"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { DisplayLine } from "@/components/atelier/common/atelier-section";
import { CaseDetails } from "@/components/atelier/requests/case-details";
import { CaseSkeleton } from "@/components/atelier/requests/case-skeleton";
import { Conversation } from "@/components/atelier/requests/conversation";
import { PaymentState } from "@/components/atelier/requests/payment-state";
import { Proposals } from "@/components/atelier/requests/proposals";
import { QuoteSection } from "@/components/atelier/requests/quote-section";
import { ReceiptHeader } from "@/components/atelier/requests/receipt-header";
import { SubmittedDesign } from "@/components/atelier/requests/submitted-design";
import { Button } from "@/components/ui/button";
import { useOwnerArgs } from "@/hooks/atelier/use-owner-args";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { CaseView } from "@convex/atelier/cases";

/**
 * S25–S28 (C19–C21): one request. The receipt, then what waits on the client (proposals, the quote),
 * the payment state once a commission exists, the conversation, the frozen submitted design and the
 * details given. Unknown, malformed or someone else's ids are not found, inline: the subscription stays
 * live, so an answer that changes (the account's token arriving, a sign-in) replaces the not-found view.
 */
export function CasePage({ caseId }: { caseId: string }) {
  const request = useQuery(api.atelier.cases.get, useOwnerArgs({ caseId }));
  if (request === undefined) return <CaseSkeleton />;
  if (request === null) return <RequestNotFound />;
  return <CaseDetail request={request} />;
}

/** The one not-found copy for a request, used inline here and by the route's not-found file. */
export function RequestNotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-16">
      <DisplayLine>This request could not be found.</DisplayLine>
      <p className="text-sm leading-relaxed text-muted-foreground">
        The link may be incomplete, the request may belong to another browser or account, or it never existed. Your
        requests are listed under Requests; sign in if you sent this one from your account.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          className="h-11 rounded-none px-5"
          render={<Link href={routes.atelier.requests} />}
          nativeButton={false}
        >
          Your requests
        </Button>
        <Link
          href={routes.atelier.home}
          className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4 hover:text-muted-foreground"
        >
          The Atelier
        </Link>
      </div>
    </div>
  );
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
