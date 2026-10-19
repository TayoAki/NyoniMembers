"use client";

import Link from "next/link";
import { StatusLine } from "@/components/atelier/common/status-line";
import {
  APPOINTMENT_TONES,
  formatConfirmed,
  formatWindow,
  statusWords,
  whereWords,
} from "@/components/atelier/fittings/appointment-words";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { AppointmentView } from "@convex/atelier/appointments";

/** One appointment in the list: the service, where, the truthful status, and the windows or the confirmed time. */
export function AppointmentRow({ appointment }: { appointment: AppointmentView }) {
  const confirmed =
    appointment.confirmed && appointment.confirmedStart !== null
      ? formatConfirmed(appointment.confirmedStart, appointment.confirmedEnd, appointment.timeZone)
      : null;
  return (
    <li className="grid gap-4 py-5 lg:grid-cols-[1fr_auto] lg:items-start lg:gap-8">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-base font-medium">{appointment.serviceLabel}</h3>
          <span className="text-sm text-muted-foreground">{whereWords(appointment)}</span>
        </div>
        <StatusLine tone={APPOINTMENT_TONES[appointment.status]}>{statusWords(appointment)}</StatusLine>
        {confirmed ? (
          <p className="text-sm text-muted-foreground">
            {confirmed.zone} · {appointment.timeZone}
          </p>
        ) : appointment.preferredWindows.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Preferred: {appointment.preferredWindows.map(formatWindow).join("; ")}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Requested {formatDate(appointment.createdAt)}</span>
          {appointment.eventDate ? <span>For {formatDate(appointment.eventDate)}</span> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <Button
          variant="outline"
          className="h-11 rounded-none px-5"
          render={<Link href={routes.atelier.fitting(appointment._id)} />}
          nativeButton={false}
        >
          Details
        </Button>
      </div>
    </li>
  );
}
