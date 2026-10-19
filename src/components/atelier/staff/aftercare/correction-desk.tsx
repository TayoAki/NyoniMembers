"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { Mono } from "@/components/atelier/common/mono";
import { OrderBook, OrderBookRow } from "@/components/atelier/common/order-book";
import { StatusLine } from "@/components/atelier/common/status-line";
import { SpecOrderBook } from "@/components/atelier/staff/case/case-design";
import { hasStaffRole, StaffRoleGate, StaffShell, useStaffStanding } from "@/components/atelier/staff/staff-shell";
import { ErrorAlert } from "@/components/common/error-alert";
import { ItemImage } from "@/components/common/item-image";
import { toClientError } from "@/lib/errors";
import { formatDate, formatDateTime, formatUsd } from "@/lib/format";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { StaffCorrectionView } from "@convex/atelier/corrections";
import type { StaffStatus } from "@convex/atelier/staff";
import { CASE_PRIORITY_LABELS } from "@convex/shared/atelier/enums";
import { CorrectionDeskSkeleton } from "./aftercare-skeleton";
import { canTransition, CORRECTION_STATUS_TONES } from "./aftercare-words";
import { RefundPanel } from "./refund-panel";
import { RemedyForm } from "./remedy-form";
import { StatusActions } from "./status-actions";

const ROLES = ["operations", "finance"] as const;

/**
 * A07 detail (O07): one correction with the commission exactly as it was made beside it (scenario 11).
 * `staffGet` throws for an unknown id, so the read sits inside a boundary that turns NOT_FOUND into the
 * segment's not-found page and anything else into an inline error with a retry.
 */
export function CorrectionDesk({ correctionId }: { correctionId: string }) {
  return (
    <StaffRoleGate
      role={ROLES}
      fallback={
        <StaffShell title="Correction">
          <CorrectionDeskSkeleton />
        </StaffShell>
      }
    >
      <CorrectionLoadBoundary>
        <CorrectionLoader correctionId={correctionId} />
      </CorrectionLoadBoundary>
    </StaffRoleGate>
  );
}

function CorrectionLoader({ correctionId }: { correctionId: string }) {
  const standing = useStaffStanding();
  // The route gives a string; the server validates the id and the boundary above handles a bad one.
  const correction = useQuery(api.atelier.corrections.staffGet, {
    correctionId: correctionId as Id<"atelierCorrections">,
  });
  if (correction === undefined || standing.status !== "ready") {
    return (
      <StaffShell title="Correction">
        <CorrectionDeskSkeleton />
      </StaffShell>
    );
  }
  return <CorrectionDeskView correction={correction} me={standing.me} />;
}

/** Pure composition: give it the staff view and the standing and it renders deterministically. */
export function CorrectionDeskView({ correction, me }: { correction: StaffCorrectionView; me: StaffStatus | null }) {
  const operations = hasStaffRole(me, "operations");
  const finance = hasStaffRole(me, "finance");
  const canPropose = operations && canTransition(correction.status, "remedy_proposed");
  const remedy = correction.remedy;
  return (
    <StaffShell
      title={`${correction.clientName} · ${correction.kindLabel.toLowerCase()}`}
      description={`${correction.statusLabel} · raised ${formatDate(correction.createdAt)}${correction.regionLabel ? ` · ${correction.regionLabel}` : ""}.`}
    >
      <div className="space-y-2">
        <AtelierSection
          id="issue"
          title="The issue"
          description="As the client raised it. Every staff action on this page is audited and shows the words the client will read."
        >
          <OrderBook>
            <OrderBookRow
              label="Status"
              value={
                <StatusLine tone={CORRECTION_STATUS_TONES[correction.status]}>{correction.statusLabel}</StatusLine>
              }
              note={
                correction.escalatedAt !== null ? `Escalated ${formatDateTime(correction.escalatedAt)}.` : undefined
              }
            />
            <OrderBookRow
              label="Asked for"
              value={correction.kindLabel}
              code={correction.kind}
              note={
                correction.requiresHouseReview
                  ? "A cancellation asked for after release: nothing is cancelled until the house confirms it."
                  : undefined
              }
              tone={correction.requiresHouseReview ? "warning" : "default"}
            />
            <OrderBookRow
              label="Region"
              value={correction.regionLabel ?? "Not named"}
              tone={correction.regionLabel ? "default" : "muted"}
              note={
                correction.isDetailMismatch
                  ? "A detail does not match the design: a manufacturing check against the specification below, not a fit correction."
                  : undefined
              }
            />
            <OrderBookRow
              label="Description"
              value={<span className="whitespace-pre-wrap">{correction.description}</span>}
            />
            <OrderBookRow
              label="Photographs"
              value={
                correction.photoUrls.length === 0 ? "None sent" : `${correction.photoUrls.length} sent by the client`
              }
              tone={correction.photoUrls.length === 0 ? "muted" : "default"}
              note={
                correction.photoUrls.length > 0 ? (
                  <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {correction.photoUrls.map((url, index) => (
                      <li key={url}>
                        <ItemImage
                          src={url}
                          alt={`Photograph ${index + 1} sent with the correction`}
                          variant="photo"
                          className="rounded-sm"
                        />
                      </li>
                    ))}
                  </ul>
                ) : undefined
              }
            />
            <OrderBookRow
              label="Priority"
              value={CASE_PRIORITY_LABELS[correction.casePriority]}
              tone={correction.casePriority === "high" ? "warning" : "default"}
            />
            <OrderBookRow
              label="Request"
              value={correction.caseOwner ? `Owned by ${correction.caseOwner}` : "Unassigned"}
              tone={correction.caseOwner ? "default" : "warning"}
              note={correction.ownerKind === "guest" ? "The client designs from a browser, not an account." : undefined}
              action={
                <Link
                  href={routes.staffAtelier.case(correction.caseId)}
                  className="text-sm underline underline-offset-4"
                >
                  Open the request
                </Link>
              }
            />
            {correction.reassessment ? (
              <OrderBookRow
                label="Client's reassessment"
                value={correction.reassessment.outcome === "resolved" ? "The fit is right now" : "Still an issue"}
                tone={correction.reassessment.outcome === "resolved" ? "default" : "warning"}
                note={`${formatDateTime(correction.reassessment.at)} · ${correction.reassessment.note}`}
              />
            ) : null}
            <OrderBookRow label="Receipt" value={<Mono upper={false}>{correction._id}</Mono>} />
          </OrderBook>
        </AtelierSection>

        <AtelierSection
          id="commission"
          title="The commission as it was made"
          description={`${correction.order.statusLabel}${correction.order.releasedAt !== null ? ` · released ${formatDate(correction.order.releasedAt)}` : ""}${correction.order.deliveredAt !== null ? ` · delivered ${formatDate(correction.order.deliveredAt)}` : ""}. The specification below is the one the cutter received; the fit profile is the version it was cut against.`}
          actions={
            <Link href={routes.staffAtelier.order(correction.orderId)} className="text-sm underline underline-offset-4">
              Open the commission
            </Link>
          }
        >
          <div className="space-y-5">
            <OrderBook>
              <OrderBookRow
                label="Fit profile"
                value={
                  correction.fitProfileVersionBefore !== null
                    ? `Version ${correction.fitProfileVersionBefore} when raised`
                    : "No approved profile when raised"
                }
                tone={correction.fitProfileVersionBefore !== null ? "default" : "warning"}
                note={
                  correction.fitProfileVersionAfter !== null
                    ? `Version ${correction.fitProfileVersionAfter} approved since.`
                    : undefined
                }
              />
              <OrderBookRow
                label="Design"
                value={correction.order.summary}
                code={correction.order.specHash.slice(0, 12)}
              />
              {correction.payment ? (
                <OrderBookRow
                  label="Payment"
                  value={correction.payment.stateLabel}
                  note={correction.payment.amountUsd !== null ? formatUsd(correction.payment.amountUsd) : undefined}
                />
              ) : null}
            </OrderBook>
            <SpecOrderBook lines={correction.order.lines} />
          </div>
        </AtelierSection>

        {correction.priorCorrections.length > 0 ? (
          <AtelierSection
            id="prior"
            title="Earlier corrections on this commission"
            description="Repeated issues are the signal to escalate."
          >
            <OrderBook>
              {correction.priorCorrections.map((prior) => (
                <OrderBookRow
                  key={prior._id}
                  label={formatDate(prior.createdAt)}
                  value={`${prior.kindLabel}${prior.regionLabel ? ` · ${prior.regionLabel}` : ""}`}
                  note={`${prior.statusLabel}${prior.refundStateLabel ? ` · ${prior.refundStateLabel}` : ""}`}
                  action={
                    <Link
                      href={routes.staffAtelier.correction(prior._id)}
                      className="text-sm underline underline-offset-4"
                    >
                      Open
                    </Link>
                  }
                />
              ))}
            </OrderBook>
          </AtelierSection>
        ) : null}

        <AtelierSection
          id="remedy"
          title="Remedy"
          description="Actual coverage, logistics, timing and an approval owner. The client accepts it on their order; nothing is promised before."
        >
          <div className="space-y-6">
            {remedy ? (
              <OrderBook>
                <OrderBookRow
                  label="Proposed"
                  value={remedy.kindLabel}
                  code={remedy.kind}
                  note={remedy.approvedBy ? `Approved by ${remedy.approvedBy}.` : undefined}
                />
                <OrderBookRow
                  label="Coverage"
                  value={remedy.coverageLabel}
                  note={remedy.amountUsd !== null && remedy.amountUsd > 0 ? formatUsd(remedy.amountUsd) : undefined}
                />
                <OrderBookRow
                  label="Logistics"
                  value={<span className="whitespace-pre-wrap">{remedy.logistics}</span>}
                />
                <OrderBookRow
                  label="Target"
                  value={remedy.deadline !== null ? `${formatDate(remedy.deadline)} · Estimate` : "No date set"}
                  tone={remedy.deadline !== null ? "default" : "muted"}
                />
              </OrderBook>
            ) : (
              <p className="text-sm text-muted-foreground">No remedy has been proposed yet.</p>
            )}
            {canPropose ? <RemedyForm correction={correction} /> : null}
            {!canPropose && operations ? (
              <p className="text-sm text-muted-foreground">
                A remedy can be proposed once the issue is triaged, or again while one is proposed or the case is
                escalated.
              </p>
            ) : null}
            {!operations ? (
              <p className="text-sm text-muted-foreground">Proposing a remedy needs the operations role.</p>
            ) : null}
          </div>
        </AtelierSection>

        <AtelierSection
          id="refund"
          title="Refund"
          description="Approval and confirmation are different facts, and the client reads them differently."
        >
          <RefundPanel correction={correction} finance={finance} operations={operations} />
        </AtelierSection>

        <AtelierSection
          id="status"
          title="Status"
          description="Only legal next states are offered. Closing states need a note the client reads."
        >
          <StatusActions correction={correction} operations={operations} finance={finance} />
        </AtelierSection>
      </div>
    </StaffShell>
  );
}

type BoundaryState = { error: Error | null };

class CorrectionLoadBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (process.env.NODE_ENV !== "production") console.error(error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const client = toClientError(error);
    if (client.code === "NOT_FOUND" || /ArgumentValidationError|Validator error/.test(client.message)) notFound();
    return (
      <StaffShell title="Correction" description="This correction could not be loaded.">
        <ErrorAlert
          title="Loading the correction failed"
          message={client.message}
          onRetry={() => this.setState({ error: null })}
          retryLabel="Try again"
        />
      </StaffShell>
    );
  }
}
