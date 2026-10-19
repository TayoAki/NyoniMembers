"use client";

import { useQuery } from "convex/react";
import { Inbox } from "lucide-react";
import Link from "next/link";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { hasStaffRole, StaffRoleGate, StaffShell, useStaffStanding } from "@/components/atelier/staff/staff-shell";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { formatDate, formatRelative } from "@/lib/format";
import { toClientError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { StaffCaseView } from "@convex/atelier/cases";
import type { StaffStatus } from "@convex/atelier/staff";
import { AppointmentPanel } from "./appointment-panel";
import { CaseConversation } from "./case-conversation";
import { DesignSection } from "./case-design";
import { RequestSection } from "./case-header";
import { CaseSkeleton } from "./case-skeleton";
import { NotificationsPanel } from "./notifications-panel";
import { ProposalsSection } from "./proposal-list";
import { QuotesSection } from "./quote-list";
import { SamplePanel } from "./sample-panel";

/**
 * The case desk (A01 detail; O01, O04, C18, C04, C20): one request, everything the house knows about it
 * and every action a concierge or finance member can take. `staffGet` throws for an unknown id, so the
 * read sits inside a boundary that turns NOT_FOUND into the segment's not-found page and anything else
 * into an inline error with a retry.
 */
export function CaseDesk({ caseId }: { caseId: string }) {
  return (
    <StaffRoleGate role="concierge" fallback={<CaseSkeleton />}>
      <CaseLoadBoundary>
        <CaseLoader caseId={caseId} />
      </CaseLoadBoundary>
    </StaffRoleGate>
  );
}

function CaseLoader({ caseId }: { caseId: string }) {
  const standing = useStaffStanding();
  // The route gives a string; the server validates the id and the boundary above handles a bad one.
  const caseView = useQuery(api.atelier.cases.staffGet, { caseId: caseId as Id<"atelierCases"> });
  if (caseView === undefined || standing.status !== "ready") return <CaseSkeleton />;
  return <CaseDeskView caseView={caseView} me={standing.me} />;
}

/** Pure composition: give it a case view and the standing and it renders deterministically. */
export function CaseDeskView({ caseView, me }: { caseView: StaffCaseView; me: StaffStatus | null }) {
  const finance = hasStaffRole(me, "finance");
  return (
    <StaffShell
      title={`${caseView.kindLabel} · ${caseView.contact.name}`}
      description={`${caseView.statusLabel} · received ${formatDate(caseView.createdAt)} · last activity ${formatRelative(caseView.lastActivityAt)}.`}
    >
      <div className="space-y-2">
        <RequestSection caseView={caseView} me={me} />
        <DesignSection caseView={caseView} />
        {caseView.sample ? (
          <SamplePanel
            caseId={caseView._id}
            sample={caseView.sample}
            open={caseView.open}
            clientFirstName={firstName(caseView.contact.name)}
          />
        ) : null}
        {caseView.appointment ? <AppointmentPanel appointmentId={caseView.appointment.appointmentId} /> : null}
        <CaseConversation caseView={caseView} />
        {caseView.draft ? <ProposalsSection caseView={caseView} /> : null}
        <QuotesSection caseView={caseView} me={me} finance={finance} />
        <NotificationsPanel caseId={caseView._id} />
      </div>
    </StaffShell>
  );
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "Client";
}

/** The not-found state, shared by the segment's not-found.tsx and the load boundary (a bad or unknown id). */
export function CaseNotFoundView() {
  return (
    <StaffShell title="Request" description="This request could not be found.">
      <EmptyState
        icon={Inbox}
        title="No request with that id"
        description="The link may be incomplete or the id may belong to another table. Open the request from the queue instead."
        action={
          <Button variant="outline" nativeButton={false} render={<Link href={routes.staffAtelier.queue} />}>
            Back to the queue
          </Button>
        }
      />
    </StaffShell>
  );
}

type BoundaryState = { error: Error | null };

class CaseLoadBoundary extends Component<{ children: ReactNode }, BoundaryState> {
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
    if (client.code === "NOT_FOUND" || /ArgumentValidationError|Validator error/.test(client.message)) {
      return <CaseNotFoundView />;
    }
    return (
      <StaffShell title="Request" description="This request could not be loaded.">
        <ErrorAlert
          title="Loading the request failed"
          message={client.message}
          onRetry={() => this.setState({ error: null })}
          retryLabel="Try again"
        />
      </StaffShell>
    );
  }
}
