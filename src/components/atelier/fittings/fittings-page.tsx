"use client";

import { useQuery } from "convex/react";
import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { AppointmentRow } from "@/components/atelier/fittings/appointment-row";
import { PENDING_SENTENCE } from "@/components/atelier/fittings/appointment-words";
import { FittingsSkeleton } from "@/components/atelier/fittings/fittings-skeleton";
import { RequestFittingForm } from "@/components/atelier/fittings/request-fitting-form";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { useOwnerArgs } from "@/hooks/atelier/use-owner-args";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { AppointmentView, RequestResult } from "@convex/atelier/appointments";
import { APPOINTMENT_STATUS_LABELS } from "@convex/shared/atelier/enums";

const CLOSED: readonly AppointmentView["status"][] = ["cancelled", "completed"];

/**
 * S22 (C18): every fitting this browser or account has asked for, and the request form. Requests are
 * durable and pending; only a concierge's confirmation with a calendar reference makes one "Confirmed".
 */
export function FittingsPage() {
  const searchParams = useSearchParams();
  const appointments = useQuery(api.atelier.appointments.listMine, useOwnerArgs({}));
  const [formOpen, setFormOpen] = useState(searchParams.get("request") === "1");
  const [receipt, setReceipt] = useState<RequestResult | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (formOpen) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [formOpen]);
  const draftParam = searchParams.get("draft");
  const caseParam = searchParams.get("case");

  if (appointments === undefined) return <FittingsSkeleton />;

  const open = appointments.filter((appointment) => !CLOSED.includes(appointment.status));
  const closed = appointments.filter((appointment) => CLOSED.includes(appointment.status));
  const empty = appointments.length === 0;

  function openForm() {
    setReceipt(null);
    setFormOpen(true);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const requestButton = (
    <Button className="h-11 rounded-none px-5" onClick={openForm} disabled={formOpen}>
      Request a fitting
    </Button>
  );

  return (
    <div className="space-y-8 pt-6">
      <PageHeader
        title="Fittings."
        description="Consultations, measurements and fittings at a showroom, or a video appointment. You ask for the windows that suit you; the house confirms a real time. A preferred date is never a reserved slot."
        actions={empty ? undefined : requestButton}
      />

      {receipt ? <Receipt result={receipt} onAnother={openForm} /> : null}

      {empty && !formOpen ? (
        <EmptyState
          icon={CalendarClock}
          title="No fittings requested yet"
          description="Ask for a private consultation, measurements, a first or final fitting, or a video appointment. The house confirms a real time with you."
          action={requestButton}
          className="rounded-none"
        />
      ) : null}

      {open.length > 0 ? (
        <AtelierSection
          id="fittings-open"
          title="Open"
          description="Requests the house is confirming, and confirmed times."
        >
          <ul className="divide-y divide-foreground/10 border-y border-foreground/15" aria-label="Open fittings">
            {open.map((appointment) => (
              <AppointmentRow key={appointment._id} appointment={appointment} />
            ))}
          </ul>
        </AtelierSection>
      ) : null}

      {closed.length > 0 ? (
        <AtelierSection
          id="fittings-closed"
          title="Past"
          description="Completed and cancelled appointments stay on record."
        >
          <ul className="divide-y divide-foreground/10 border-y border-foreground/15" aria-label="Past fittings">
            {closed.map((appointment) => (
              <AppointmentRow key={appointment._id} appointment={appointment} />
            ))}
          </ul>
        </AtelierSection>
      ) : null}

      {formOpen ? (
        <div ref={formRef} className="scroll-mt-24">
          <AtelierSection
            id="request-fitting"
            title="Request a fitting"
            description="Choose the service, where, and one to three windows that suit you. A concierge replies with a confirmed time."
          >
            <RequestFittingForm
              draftId={draftParam ? (draftParam as Id<"atelierDrafts">) : undefined}
              caseId={caseParam ? (caseParam as Id<"atelierCases">) : undefined}
              onRequested={(result) => {
                setReceipt(result);
                setFormOpen(false);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              onCancel={() => setFormOpen(false)}
            />
          </AtelierSection>
        </div>
      ) : null}
    </div>
  );
}

/** The receipt words (S25): received, awaiting confirmation, with the case id. Never "booked". */
function Receipt({ result, onAnother }: { result: RequestResult; onAnother: () => void }) {
  return (
    <section
      aria-labelledby="fitting-receipt"
      aria-live="polite"
      className="space-y-4 border-t border-foreground/15 pt-6"
    >
      <h2 id="fitting-receipt" className="text-xl font-medium tracking-tight sm:text-2xl">
        Request received
      </h2>
      {result.duplicate ? (
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          This request had already reached the house; nothing was sent twice. Here it is.
        </p>
      ) : (
        <StatusLine tone="neutral" live className="text-sm">
          {APPOINTMENT_STATUS_LABELS.requested}
        </StatusLine>
      )}
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="text-muted-foreground">Request</span>
        <Mono upper={false} className="text-foreground">
          {result.caseId}
        </Mono>
      </p>
      <p className="max-w-2xl text-sm leading-relaxed text-pretty text-muted-foreground">{PENDING_SENTENCE}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          className="h-11 rounded-none px-5"
          render={<Link href={routes.atelier.fitting(result.appointmentId)} />}
          nativeButton={false}
        >
          See this fitting
        </Button>
        <Button
          variant="outline"
          className="h-11 rounded-none px-5"
          render={<Link href={routes.atelier.request(result.caseId)} />}
          nativeButton={false}
        >
          See the request
        </Button>
        <Button variant="ghost" className="h-11 rounded-none px-4" onClick={onAnother}>
          Request another
        </Button>
      </div>
    </section>
  );
}
