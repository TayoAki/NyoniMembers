"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { AtelierSection, DisplayLine } from "@/components/atelier/common/atelier-section";
import { Mono } from "@/components/atelier/common/mono";
import { OrderBook, OrderBookRow } from "@/components/atelier/common/order-book";
import { StatusLine } from "@/components/atelier/common/status-line";
import { AppointmentSkeleton } from "@/components/atelier/fittings/appointment-skeleton";
import {
  ACTOR_WORDS,
  APPOINTMENT_TONES,
  formatConfirmed,
  formatWindow,
  PENDING_SENTENCE,
  SERVICE_NOTES,
  statusWords,
  whereWords,
} from "@/components/atelier/fittings/appointment-words";
import { RescheduleForm } from "@/components/atelier/fittings/reschedule-form";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { useGuestKeyArg, useOwnerArgs } from "@/hooks/atelier/use-owner-args";
import { formatDate, formatDateTime } from "@/lib/format";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { AppointmentView } from "@convex/atelier/appointments";
import { APPOINTMENT_STATUS_LABELS } from "@convex/shared/atelier/enums";
import { HOUSE, SHOWROOMS } from "@convex/shared/house";

/**
 * S23 (C18): one appointment, its truthful state, its history, and the ways to change it. An unknown or
 * someone else's id is not found inline, so the live subscription can still replace it with the answer.
 */
export function AppointmentPage({ appointmentId }: { appointmentId: string }) {
  const appointment = useQuery(api.atelier.appointments.get, useOwnerArgs({ appointmentId }));
  if (appointment === undefined) return <AppointmentSkeleton />;
  if (appointment === null) return <AppointmentNotFound />;
  return <AppointmentDetail appointment={appointment} />;
}

/** The one not-found copy for a fitting, used inline here and by the route's not-found file. */
export function AppointmentNotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-16">
      <DisplayLine>This fitting could not be found.</DisplayLine>
      <p className="text-sm leading-relaxed text-muted-foreground">
        The link may be incomplete, the appointment may belong to another browser or account, or it never existed. Your
        fittings are listed under Fittings; sign in if you asked for this one from your account.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          className="h-11 rounded-none px-5"
          render={<Link href={routes.atelier.fittings} />}
          nativeButton={false}
        >
          Your fittings
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

function AppointmentDetail({ appointment }: { appointment: AppointmentView }) {
  const guestKeyArg = useGuestKeyArg();
  const cancel = useMutation(api.atelier.appointments.cancel);
  const [rescheduling, setRescheduling] = useState(false);
  const terminal = !appointment.canReschedule && !appointment.canCancel;
  const confirmed =
    appointment.confirmed && appointment.confirmedStart !== null
      ? formatConfirmed(appointment.confirmedStart, appointment.confirmedEnd, appointment.timeZone)
      : null;
  const showroom = SHOWROOMS.find((entry) => entry.id === appointment.showroomId) ?? null;
  const history = [...appointment.history].reverse();

  return (
    <div className="space-y-8 pt-6">
      <PageHeader
        title={`${appointment.serviceLabel}.`}
        description={SERVICE_NOTES[appointment.service]}
        actions={
          <Button
            variant="outline"
            className="h-11 rounded-none px-5"
            render={<Link href={routes.atelier.fittings} />}
            nativeButton={false}
          >
            All fittings
          </Button>
        }
      />

      <section aria-label="Status" className="space-y-3 border-t border-foreground/15 pt-5">
        <StatusLine tone={APPOINTMENT_TONES[appointment.status]} live className="text-sm">
          {statusWords(appointment)}
        </StatusLine>
        {confirmed ? (
          <div className="space-y-1">
            <p className="font-display text-2xl leading-tight font-medium tracking-[-0.01em] sm:text-3xl">
              {confirmed.day}
            </p>
            <p className="text-sm">
              {confirmed.time} <span className="text-muted-foreground">{confirmed.zone}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Times in {appointment.timeZone}.
              {appointment.calendarRef ? (
                <>
                  {" "}
                  Booking reference <Mono upper={false}>{appointment.calendarRef}</Mono>
                </>
              ) : null}
            </p>
          </div>
        ) : terminal ? (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            This appointment is {appointment.statusLabel.toLowerCase()}. Ask for a new one from Fittings when you need
            it.
          </p>
        ) : (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{PENDING_SENTENCE}</p>
        )}
      </section>

      <AtelierSection
        id="appointment-request"
        title="Your request"
        description="What you asked for, as the house holds it."
      >
        <OrderBook>
          <OrderBookRow label="Service" value={appointment.serviceLabel} />
          <OrderBookRow
            label="Where"
            value={whereWords(appointment)}
            note={
              showroom ? (
                <span className="flex flex-col gap-0.5">
                  <span>{showroom.address}</span>
                  <span>
                    <a href={`tel:${showroom.tel}`} className="underline underline-offset-4">
                      {showroom.phone}
                    </a>
                    {" · "}
                    {HOUSE.hours}
                  </span>
                </span>
              ) : (
                "Your concierge confirms how to join when the time is confirmed."
              )
            }
          />
          <OrderBookRow
            label="Preferred windows"
            value={
              appointment.preferredWindows.length > 0 ? (
                <span className="flex flex-col gap-0.5">
                  {appointment.preferredWindows.map((item) => (
                    <span key={`${item.date}-${item.period}`}>{formatWindow(item)}</span>
                  ))}
                </span>
              ) : (
                "None given"
              )
            }
            note={confirmed ? "The confirmed time above is what stands." : "Preferences, not reservations."}
          />
          <OrderBookRow label="Time zone" value={appointment.timeZone} />
          {appointment.eventDate !== null ? (
            <OrderBookRow label="The suit is for" value={formatDate(appointment.eventDate)} />
          ) : null}
          {appointment.notes ? (
            <OrderBookRow label="Notes" value={<span className="whitespace-pre-line">{appointment.notes}</span>} />
          ) : null}
          {appointment.accessibility ? (
            <OrderBookRow
              label="Access needs"
              value={<span className="whitespace-pre-line">{appointment.accessibility}</span>}
            />
          ) : null}
          <OrderBookRow label="Requested" value={formatDateTime(appointment.createdAt)} />
          {appointment.caseId ? (
            <OrderBookRow
              label="Request"
              value={
                <Link href={routes.atelier.request(appointment.caseId)} className="underline underline-offset-4">
                  See the conversation with your concierge
                </Link>
              }
              code={appointment.caseId}
            />
          ) : null}
        </OrderBook>
      </AtelierSection>

      <AtelierSection id="appointment-history" title="History" description="Every change, who made it and when.">
        <ol className="divide-y divide-foreground/10 border-y border-foreground/15" aria-label="Appointment history">
          {history.map((entry, index) => (
            <li key={`${entry.at}-${index}`} className="grid gap-1 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
              <Mono upper={false} className="pt-0.5 text-foreground/70">
                {formatDateTime(entry.at)}
              </Mono>
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm">
                  {APPOINTMENT_STATUS_LABELS[entry.to]}{" "}
                  <span className="text-muted-foreground">· {ACTOR_WORDS[entry.by]}</span>
                </p>
                {entry.note ? <p className="text-xs leading-relaxed text-muted-foreground">{entry.note}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </AtelierSection>

      <AtelierSection
        id="appointment-change"
        title="Change or cancel"
        description={
          terminal
            ? `This appointment is ${appointment.statusLabel.toLowerCase()} and cannot be changed.`
            : "New windows release any confirmed time and the house confirms again. Cancelling tells the house and withdraws the request; your design and your fit profile are untouched."
        }
      >
        {terminal ? (
          <Button
            className="h-11 rounded-none px-5"
            render={<Link href={`${routes.atelier.fittings}?request=1`} />}
            nativeButton={false}
          >
            Request a fitting
          </Button>
        ) : rescheduling ? (
          <RescheduleForm
            appointment={appointment}
            onDone={() => setRescheduling(false)}
            onCancel={() => setRescheduling(false)}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {appointment.canReschedule ? (
              <Button variant="outline" className="h-11 rounded-none px-5" onClick={() => setRescheduling(true)}>
                Reschedule
              </Button>
            ) : null}
            {appointment.canCancel ? (
              <ConfirmDialog
                trigger={
                  <Button
                    variant="ghost"
                    className="h-11 rounded-none px-4 text-muted-foreground hover:text-foreground"
                  >
                    Cancel this fitting
                  </Button>
                }
                title="Cancel this fitting?"
                description={
                  appointment.confirmed
                    ? "The confirmed time is released and the house is told. Your design and your fit profile stay exactly as they are."
                    : "The request is withdrawn and the house is told. Your design and your fit profile stay exactly as they are."
                }
                confirmLabel="Cancel the fitting"
                cancelLabel="Keep it"
                destructive
                onConfirm={() => cancel({ ...guestKeyArg, appointmentId: appointment._id })}
              />
            ) : null}
          </div>
        )}
      </AtelierSection>
    </div>
  );
}
