"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { Mono } from "@/components/atelier/common/mono";
import { OrderBook, OrderBookRow } from "@/components/atelier/common/order-book";
import { StatusLine } from "@/components/atelier/common/status-line";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ErrorAlert } from "@/components/common/error-alert";
import { LoadingRows } from "@/components/common/loading-grid";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toClientError } from "@/lib/errors";
import { formatDate, formatDateTime, formatUsd, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { EligibilityView } from "@convex/atelier/benefits";
import type { StaffCaseView } from "@convex/atelier/cases";
import type { QuoteView } from "@convex/atelier/quotes";
import type { StaffStatus } from "@convex/atelier/staff";
import { REDEMPTION_STATUS_LABELS } from "@convex/shared/atelier/enums";
import { QUOTE_STATUS_TONES } from "./case-words";
import { QuoteComposer } from "./quote-composer";

type MemberStanding =
  | { state: "not_admin" }
  | { state: "loading" }
  | { state: "no_account"; email: string }
  | { state: "ready"; userId: Id<"users">; eligibility: EligibilityView };

/**
 * The case view carries the client's contact, not their account. An admin can look the account up by the
 * contact email and read its eligibility; finance staff without admin see why they cannot (backend gap).
 */
function useMemberStanding(caseView: StaffCaseView, me: StaffStatus | null): MemberStanding {
  const isAdmin = me?.isAdmin ?? false;
  const member = useQuery(api.admin.lookupMember, isAdmin ? { email: caseView.contact.email } : "skip");
  const eligibility = useQuery(api.atelier.benefits.forMember, isAdmin && member ? { userId: member._id } : "skip");
  if (!isAdmin) return { state: "not_admin" };
  if (member === undefined) return { state: "loading" };
  if (member === null) return { state: "no_account", email: caseView.contact.email };
  if (eligibility === undefined || eligibility === null) return { state: "loading" };
  return { state: "ready", userId: member._id, eligibility };
}

/** A04 inside the case: existing versions with their truthful words, the member's benefit, and the composer. */
export function QuotesSection({
  caseView,
  me,
  finance,
}: {
  caseView: StaffCaseView;
  me: StaffStatus | null;
  finance: boolean;
}) {
  if (!finance) {
    return (
      <AtelierSection id="quotes" title="Quotes" description="Pricing a request needs the finance role.">
        {caseView.quote ? (
          <p className="text-sm text-muted-foreground">
            Version {caseView.quote.version}: {caseView.quote.statusLabel}, {formatUsd(caseView.quote.totalUsd)},
            expires {formatDate(caseView.quote.expiresAt)}.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No quote has been prepared on this request.</p>
        )}
      </AtelierSection>
    );
  }
  return <FinanceQuotes caseView={caseView} me={me} />;
}

function FinanceQuotes({ caseView, me }: { caseView: StaffCaseView; me: StaffStatus | null }) {
  const quotes = useQuery(api.atelier.quotes.staffListForCase, { caseId: caseView._id });
  const member = useMemberStanding(caseView, me);
  const [composer, setComposer] = useState<
    { mode: "closed" } | { mode: "create" } | { mode: "supersede"; quote: QuoteView }
  >({ mode: "closed" });
  const eligibility = member.state === "ready" ? member.eligibility : null;

  return (
    <AtelierSection
      id="quotes"
      title="Quotes"
      description="Every version on this request, newest first. A draft is invisible to the client; offering it supersedes any version already offered. Acceptance opens a commission and records no payment."
      actions={
        composer.mode === "closed" && caseView.open ? (
          <Button className="h-10 rounded-none px-4" onClick={() => setComposer({ mode: "create" })}>
            Prepare a quote
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-8">
        {!caseView.open ? (
          <p className="text-sm text-muted-foreground">
            This request is {caseView.statusLabel.toLowerCase()}; no quote is prepared or offered on it. A version still
            open can be withdrawn.
          </p>
        ) : null}
        <MemberBenefit member={member} />
        {quotes === undefined ? (
          <LoadingRows count={2} />
        ) : quotes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No quote has been prepared on this request.</p>
        ) : (
          <ol className="divide-y divide-foreground/10 border-y border-foreground/15">
            {quotes.map((quote) => (
              <QuoteRow
                key={quote._id}
                quote={quote}
                member={member}
                open={caseView.open}
                onSupersede={() => setComposer({ mode: "supersede", quote })}
              />
            ))}
          </ol>
        )}
        {composer.mode !== "closed" ? (
          <div className="border-t border-foreground/10 pt-6">
            <QuoteComposer
              key={composer.mode === "supersede" ? composer.quote._id : "create"}
              caseView={caseView}
              supersede={composer.mode === "supersede" ? composer.quote : null}
              eligibility={eligibility}
              onDone={() => setComposer({ mode: "closed" })}
            />
          </div>
        ) : null}
      </div>
    </AtelierSection>
  );
}

function MemberBenefit({ member }: { member: MemberStanding }) {
  const release = useMutation(api.atelier.benefits.release);
  const [note, setNote] = useState("");
  if (member.state === "not_admin") {
    return (
      <p className="text-sm text-muted-foreground">
        Membership eligibility can be looked up by an admin only; the desk has no finance-level member lookup yet.
      </p>
    );
  }
  if (member.state === "loading") return <StatusLine live>Checking the client&rsquo;s membership…</StatusLine>;
  if (member.state === "no_account") {
    return (
      <p className="text-sm text-muted-foreground">
        No account uses {member.email}; the included suit applies to members with an account only.
      </p>
    );
  }
  const { eligibility } = member;
  const redemption = eligibility.redemption;
  return (
    <OrderBook>
      <OrderBookRow
        label="Membership"
        value={eligibility.tierLabel}
        note={eligibility.status === "active" ? "Active" : "Lapsed"}
        tone={eligibility.status === "active" ? "default" : "warning"}
      />
      <OrderBookRow
        label="Included suit"
        value={
          eligibility.included
            ? eligibility.available
              ? `Available for ${eligibility.yearKey}`
              : `Not available for ${eligibility.yearKey}`
            : "Not included"
        }
        note={eligibility.reason}
        action={
          redemption?.status === "reserved" ? (
            <ConfirmDialog
              title="Release the reservation?"
              description="The member's suit becomes available again and the quote stops claiming it."
              confirmLabel="Release"
              confirmDisabled={note.trim().length === 0}
              onOpenChange={(open) => !open && setNote("")}
              onConfirm={async () => {
                await release({ redemptionId: redemption.redemptionId, note: note.trim() });
                toast.success("Reservation released.");
              }}
              trigger={
                <Button variant="outline" size="sm" className="h-8">
                  Release reservation
                </Button>
              }
            >
              <Field>
                <FieldLabel htmlFor={`release-${redemption.redemptionId}`}>Note</FieldLabel>
                <FieldDescription>Goes to the audit log. Say why.</FieldDescription>
                <Input
                  id={`release-${redemption.redemptionId}`}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </Field>
            </ConfirmDialog>
          ) : undefined
        }
      />
      {redemption ? (
        <OrderBookRow
          label="Redemption"
          value={redemption.statusLabel}
          note={`Reserved ${formatDateTime(redemption.reservedAt)}${redemption.redeemedAt !== null ? ` · used ${formatDateTime(redemption.redeemedAt)}` : ""}`}
        />
      ) : null}
    </OrderBook>
  );
}

/** One version. Offering, superseding and reserving need an open request (the server refuses otherwise); withdrawing never does. */
function QuoteRow({
  quote,
  member,
  open,
  onSupersede,
}: {
  quote: QuoteView;
  member: MemberStanding;
  open: boolean;
  onSupersede: () => void;
}) {
  const offer = useMutation(api.atelier.quotes.offer);
  const withdraw = useMutation(api.atelier.quotes.withdraw);
  const reserve = useMutation(api.atelier.benefits.reserve);
  const [pending, setPending] = useState<"offer" | "reserve" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const live = quote.status === "draft" || quote.status === "offered";
  const canReserve = open && live && member.state === "ready" && member.eligibility.available && quote.benefit === null;

  async function run(action: "offer" | "reserve") {
    setPending(action);
    setError(null);
    try {
      if (action === "offer") {
        await offer({ quoteId: quote._id });
        toast.success(`Version ${quote.version} offered. The client reads “Offered · awaiting your approval”.`);
      } else if (member.state === "ready") {
        await reserve({ userId: member.userId, quoteId: quote._id });
        toast.success("Included suit reserved against this quote. It is used only when the client accepts.");
      }
    } catch (caught) {
      setError(toClientError(caught).message);
    } finally {
      setPending(null);
    }
  }

  return (
    <li className="space-y-3 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-sm font-medium">Version {quote.version}</span>
          <StatusLine tone={QUOTE_STATUS_TONES[quote.status]}>{quote.statusLabel}</StatusLine>
          <Mono>prices revision {quote.revision.revision}</Mono>
        </div>
        <span className="text-sm font-medium tabular-nums">{formatUsd(quote.totalUsd)}</span>
      </div>
      {!quote.isCurrentRevision ? (
        <p className="text-sm text-warning">Prices an earlier design; the client is told to await a fresh quote.</p>
      ) : null}
      <dl className="grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
        <div className="flex gap-2">
          <dt>{quote.status === "expired" ? "Expired" : "Expires"}</dt>
          <dd>{formatDate(quote.expiresAt)}</dd>
        </div>
        {quote.offeredAt !== null ? (
          <div className="flex gap-2">
            <dt>Offered</dt>
            <dd>{formatDateTime(quote.offeredAt)}</dd>
          </div>
        ) : null}
        {quote.acceptedAt !== null ? (
          <div className="flex gap-2">
            <dt>Accepted</dt>
            <dd>{formatDateTime(quote.acceptedAt)}</dd>
          </div>
        ) : null}
        {quote.leadTimeWeeks !== null ? (
          <div className="flex gap-2">
            <dt>Lead time</dt>
            <dd>about {pluralize(quote.leadTimeWeeks, "week")} from the first fitting</dd>
          </div>
        ) : null}
        {quote.fittingsIncluded !== null ? (
          <div className="flex gap-2">
            <dt>Fittings included</dt>
            <dd>{quote.fittingsIncluded}</dd>
          </div>
        ) : null}
        {quote.benefit ? (
          <div className="flex gap-2 sm:col-span-2">
            <dt>Benefit</dt>
            <dd>
              {quote.benefit.description} · {REDEMPTION_STATUS_LABELS[quote.benefit.redemptionStatus]}
            </dd>
          </div>
        ) : null}
      </dl>
      <ul className="divide-y divide-foreground/10 border-y border-foreground/10 text-sm">
        {quote.lines.map((line, index) => (
          <li key={`${line.code}-${index}`} className="grid grid-cols-[1fr_auto] gap-x-4 py-1.5">
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              <span>{line.label}</span>
              <span className="text-xs text-muted-foreground">{line.kindLabel}</span>
              <Mono>{line.code}</Mono>
            </span>
            <span className="tabular-nums">{formatUsd(line.amountUsd)}</span>
          </li>
        ))}
        <li className="grid grid-cols-[1fr_auto] gap-x-4 py-1.5 text-muted-foreground">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatUsd(quote.subtotalUsd)}</span>
        </li>
      </ul>
      <p className="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">{quote.terms}</p>
      {error ? <ErrorAlert title="That did not go through" message={error} /> : null}
      <div className="flex flex-wrap items-center gap-2">
        {open && quote.status === "draft" ? (
          <Button size="sm" className="h-8" disabled={pending !== null} onClick={() => void run("offer")}>
            {pending === "offer" ? <Spinner data-icon="inline-start" /> : null}
            Offer to the client
          </Button>
        ) : null}
        {open && live ? (
          <Button variant="outline" size="sm" className="h-8" onClick={onSupersede}>
            Supersede with a new version
          </Button>
        ) : null}
        {canReserve ? (
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={pending !== null}
            onClick={() => void run("reserve")}
          >
            {pending === "reserve" ? <Spinner data-icon="inline-start" /> : null}
            Reserve the included suit
          </Button>
        ) : null}
        {live ? (
          <ConfirmDialog
            destructive
            title={`Withdraw version ${quote.version}?`}
            description="The client can no longer accept it and any benefit reservation on it is released. Prepare a new version to price the design again."
            confirmLabel="Withdraw"
            onOpenChange={(open) => !open && setNote("")}
            onConfirm={async () => {
              await withdraw({ quoteId: quote._id, ...(note.trim() ? { note: note.trim() } : {}) });
              toast.success("Withdrawn.");
            }}
            trigger={
              <Button variant="ghost" size="sm" className="h-8">
                Withdraw
              </Button>
            }
          >
            <Field>
              <FieldLabel htmlFor={`withdraw-${quote._id}`}>Note</FieldLabel>
              <FieldDescription>Optional; goes to the audit log.</FieldDescription>
              <Input id={`withdraw-${quote._id}`} value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>
          </ConfirmDialog>
        ) : null}
        {quote.orderId ? (
          <Button
            variant="link"
            size="sm"
            className="h-8"
            nativeButton={false}
            render={<Link href={routes.staffAtelier.order(quote.orderId)} />}
          >
            Open the commission
          </Button>
        ) : null}
      </div>
    </li>
  );
}
