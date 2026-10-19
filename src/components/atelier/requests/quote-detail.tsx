"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { Mono } from "@/components/atelier/common/mono";
import { OrderBook, OrderBookRow, OrderBookSection } from "@/components/atelier/common/order-book";
import { StatusLine } from "@/components/atelier/common/status-line";
import { expiryWords, groupQuoteLines, isQuoteExpired, QUOTE_TONES } from "@/components/atelier/requests/case-words";
import { QuoteAccept } from "@/components/atelier/requests/quote-accept";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime, formatUsd, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { CaseView } from "@convex/atelier/cases";
import type { QuoteView } from "@convex/atelier/quotes";
import { REDEMPTION_STATUS_LABELS } from "@convex/shared/atelier/enums";

/**
 * S27 (C21): one quote as the house priced it — lines by kind, the total, the benefit when one is
 * carried, lead time, fittings, terms and expiry — and the one action that is true for its state. A quote
 * on a request the house has closed can be read but not accepted; the server refuses it too.
 */
export function QuoteDetail({ quote, request }: { quote: QuoteView; request: Pick<CaseView, "open" | "statusLabel"> }) {
  const [now] = useState(() => Date.now());
  const expired = isQuoteExpired(quote, now);
  const acceptable = quote.status === "offered" && quote.isCurrentRevision && !expired && request.open;
  const groups = groupQuoteLines(quote.lines);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <StatusLine
          tone={expired && quote.status === "offered" ? "warning" : QUOTE_TONES[quote.status]}
          live
          className="text-sm"
        >
          {expired && quote.status === "offered" ? "Expired" : quote.statusLabel}
        </StatusLine>
        <p className="text-sm text-muted-foreground">{expiryWords(quote, now)}</p>
      </div>

      {!quote.isCurrentRevision ? (
        <Alert className="rounded-none border-foreground/20">
          <AlertTitle>This quote is for an earlier design</AlertTitle>
          <AlertDescription>
            It prices revision {quote.revision.revision}, and your design has changed since. It cannot be accepted for
            the newer design; your concierge follows with a fresh quote.
          </AlertDescription>
        </Alert>
      ) : null}

      <OrderBook aria-label={`Quote version ${quote.version}`}>
        {groups.map((group) => (
          <Fragment key={group.kind}>
            <OrderBookSection>{group.kindLabel}</OrderBookSection>
            {group.lines.map((line) => (
              <OrderBookRow
                key={`${line.kind}-${line.code}`}
                label={line.label}
                value={<span className="tabular-nums">{formatUsd(line.amountUsd)}</span>}
                code={line.code}
              />
            ))}
          </Fragment>
        ))}
        {quote.benefit ? (
          <>
            <OrderBookSection>Membership</OrderBookSection>
            <OrderBookRow
              label={quote.benefit.tierLabel}
              value={quote.benefit.description}
              note={REDEMPTION_STATUS_LABELS[quote.benefit.redemptionStatus]}
            />
          </>
        ) : null}
        <OrderBookSection>Total</OrderBookSection>
        <OrderBookRow
          label="Subtotal"
          value={<span className="tabular-nums">{formatUsd(quote.subtotalUsd)}</span>}
          tone="muted"
        />
        <OrderBookRow
          label="Total"
          value={<span className="text-base font-medium tabular-nums">{formatUsd(quote.totalUsd)}</span>}
        />
      </OrderBook>

      <OrderBook aria-label="Lead time, fittings and terms">
        <OrderBookRow
          label="Lead time"
          value={
            quote.leadTimeWeeks !== null
              ? `About ${pluralize(quote.leadTimeWeeks, "week")} from your first fitting`
              : "Confirmed with your concierge"
          }
        />
        <OrderBookRow
          label="Fittings"
          value={
            quote.fittingsIncluded !== null
              ? `${pluralize(quote.fittingsIncluded, "fitting")} included`
              : "As your garment needs"
          }
        />
        <OrderBookRow label="Terms" value={<span className="whitespace-pre-line">{quote.terms}</span>} />
        <OrderBookRow
          label="Design"
          value={`Revision ${quote.revision.revision}`}
          note={
            quote.isCurrentRevision
              ? "The design this quote prices is the one under Submitted design below."
              : "An earlier revision of your design."
          }
        />
        <OrderBookRow
          label={quote.status === "accepted" ? "Accepted" : "Offered"}
          value={formatDateTime(quote.acceptedAt ?? quote.offeredAt ?? quote.createdAt)}
          code={quote._id}
        />
      </OrderBook>

      {quote.status === "accepted" ? (
        <div className="space-y-3 border-t border-foreground/15 pt-5">
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Accepted {quote.acceptedAt ? formatDate(quote.acceptedAt) : ""}. The commission it opened, and what the
            house has recorded against it, are below under Payment.
          </p>
          {quote.orderId ? (
            <Button
              variant="outline"
              className="h-11 rounded-none px-5"
              render={<Link href={routes.atelier.order(quote.orderId)} />}
              nativeButton={false}
            >
              See your commission
            </Button>
          ) : null}
        </div>
      ) : acceptable ? (
        <QuoteAccept quote={quote} />
      ) : quote.status === "offered" && !expired && !request.open ? (
        <p className="max-w-2xl border-t border-foreground/15 pt-5 text-sm leading-relaxed text-muted-foreground">
          This request is {request.statusLabel.toLowerCase()}; the quote can no longer be accepted. Send a new request
          from your design and your concierge will quote it again.
        </p>
      ) : expired ? (
        <p className="max-w-2xl border-t border-foreground/15 pt-5 text-sm leading-relaxed text-muted-foreground">
          This quote expired on {formatDate(quote.expiresAt)}. Ask your concierge for a fresh quote in the conversation
          below; your design is unchanged.
        </p>
      ) : quote.status === "withdrawn" ? (
        <p className="max-w-2xl border-t border-foreground/15 pt-5 text-sm leading-relaxed text-muted-foreground">
          The house withdrew this quote. Your concierge will say why in the conversation below; your design is
          unchanged.
        </p>
      ) : null}
    </div>
  );
}

/** Superseded and other earlier versions, one ruled row each. */
export function EarlierQuotes({ quotes }: { quotes: QuoteView[] }) {
  return (
    <div className="mt-8 space-y-3">
      <h3 className="text-base font-medium">Earlier quotes</h3>
      <ol className="divide-y divide-foreground/10 border-y border-foreground/15" aria-label="Earlier quotes">
        {quotes.map((quote) => (
          <li
            key={quote._id}
            className="grid gap-1.5 py-3 sm:grid-cols-[11rem_minmax(0,1fr)_auto] sm:items-baseline sm:gap-6"
          >
            <span className="text-sm">
              Version {quote.version}{" "}
              <span className="text-muted-foreground">· revision {quote.revision.revision}</span>
            </span>
            <StatusLine tone={QUOTE_TONES[quote.status]}>{quote.statusLabel}</StatusLine>
            <span className="flex flex-wrap items-baseline gap-x-3 text-sm sm:justify-end">
              <span className="tabular-nums">{formatUsd(quote.totalUsd)}</span>
              <Mono upper={false}>{formatDate(quote.offeredAt ?? quote.createdAt)}</Mono>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
