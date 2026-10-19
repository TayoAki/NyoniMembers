"use client";

import { useQuery } from "convex/react";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { EarlierQuotes, QuoteDetail } from "@/components/atelier/requests/quote-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { useOwnerArgs } from "@/hooks/atelier/use-owner-args";
import { api } from "@convex/_generated/api";
import type { CaseView } from "@convex/atelier/cases";
import { HOUSE_POLICY } from "@convex/shared/atelier/policy";

/**
 * S27: the quotes offered on this request, newest version first. A quote still being prepared is not
 * shown; a quote request without one yet says so plainly rather than inventing a price or a date.
 */
export function QuoteSection({ request }: { request: CaseView }) {
  const quotes = useQuery(api.atelier.quotes.listForCase, useOwnerArgs({ caseId: request._id }));
  const expectsQuote = request.kind === "quote" || request.quote !== null;

  if (quotes === undefined) {
    if (!expectsQuote) return null;
    return (
      <AtelierSection id="quote" title="Quote">
        <div
          className="divide-y divide-foreground/10 border-y border-foreground/15"
          aria-busy="true"
          aria-label="Loading the quote"
        >
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="grid gap-2 py-3 sm:grid-cols-[minmax(7rem,11rem)_1fr]">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      </AtelierSection>
    );
  }

  if (quotes.length === 0) {
    if (!expectsQuote) return null;
    return (
      <AtelierSection
        id="quote"
        title="Quote"
        description="Priced by the house for the exact design you submitted. Accepting a quote opens your commission; it is not a payment."
      >
        <p className="max-w-2xl border-y border-foreground/15 py-4 text-sm leading-relaxed text-muted-foreground">
          No quote yet. Your concierge prepares it after reviewing your design; it appears here when it is offered, with
          its expiry. {HOUSE_POLICY.proposed.responseTime}
        </p>
      </AtelierSection>
    );
  }

  const [current, ...earlier] = quotes;
  return (
    <AtelierSection
      id="quote"
      title={`Quote · version ${current.version}`}
      description="Priced by the house for the exact design you submitted. Accepting a quote opens your commission; it is not a payment."
    >
      <QuoteDetail quote={current} request={request} />
      {earlier.length > 0 ? <EarlierQuotes quotes={earlier} /> : null}
    </AtelierSection>
  );
}
