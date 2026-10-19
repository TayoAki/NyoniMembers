"use client";

import { useMutation, useQuery } from "convex/react";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { Mono } from "@/components/atelier/common/mono";
import { OrderBook, OrderBookRow } from "@/components/atelier/common/order-book";
import { StatusLine } from "@/components/atelier/common/status-line";
import { ErrorAlert } from "@/components/common/error-alert";
import { LoadingRows } from "@/components/common/loading-grid";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toClientError } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/format";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { StaffAppointmentRow } from "@convex/atelier/appointments";
import { APPOINTMENT_STATUS_LABELS } from "@convex/shared/atelier/enums";
import { APPOINTMENT_TRANSITIONS } from "./case-words";

const HOUR_MS = 3_600_000;

/** A preferred window names a day (stored at UTC midnight) and a part of it. */
function formatWindowDay(date: number): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(date));
}

/** "Saturday, November 14, 2026 at 11:00 AM" in the client's zone, the way the server words the confirmation. */
function formatInZone(at: number, timeZone: string): string {
  const options: Intl.DateTimeFormatOptions = { dateStyle: "full", timeStyle: "short" };
  try {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone }).format(new Date(at));
  } catch {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(new Date(at));
  }
}

function toLocalInput(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): number | null {
  if (!value) return null;
  const at = new Date(value).getTime();
  return Number.isFinite(at) ? at : null;
}

const noSubscription = () => () => {};
/** The current minute as a datetime-local value, read on the client only; the server renders no floor. */
function useNowInput(): string | undefined {
  return useSyncExternalStore(
    noSubscription,
    () => toLocalInput(Date.now()),
    () => undefined,
  );
}

/** C18 on the house's side: the request's windows, and Confirmed only with a real booking reference. */
export function AppointmentPanel({ appointmentId }: { appointmentId: Id<"atelierAppointments"> }) {
  const appointment = useQuery(api.atelier.appointments.staffGet, { appointmentId });
  return (
    <AtelierSection
      id="appointment"
      title="Fitting request"
      description="A preferred window is not a reserved slot. The client reads “Confirmed for …” only once a start, an end and the Square Appointments booking reference are recorded here."
    >
      {appointment === undefined ? <LoadingRows count={4} /> : <AppointmentDetail appointment={appointment} />}
    </AtelierSection>
  );
}

export function AppointmentDetail({ appointment }: { appointment: StaffAppointmentRow }) {
  const canConfirm = APPOINTMENT_TRANSITIONS[appointment.status].includes("confirmed");
  const canComplete = appointment.status === "confirmed";
  return (
    <div className="space-y-6">
      <OrderBook>
        <OrderBookRow label="Service" value={appointment.serviceLabel} />
        <OrderBookRow
          label="Where"
          value={appointment.showroomLabel}
          note={appointment.showroom ? `${appointment.showroom.address} · ${appointment.showroom.phone}` : "By video."}
        />
        <OrderBookRow
          label="Status"
          value={
            <StatusLine
              tone={appointment.confirmed ? "success" : appointment.status === "cancelled" ? "neutral" : "warning"}
            >
              {appointment.statusLabel}
            </StatusLine>
          }
          note={
            appointment.confirmed && appointment.confirmedStart !== null
              ? `Confirmed for ${formatInZone(appointment.confirmedStart, appointment.timeZone)} (${appointment.timeZone}).`
              : undefined
          }
        />
        <OrderBookRow
          label="Preferred windows"
          value={
            appointment.preferredWindows.length === 0 ? (
              <span className="text-muted-foreground">None given</span>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {appointment.preferredWindows.map((window) => (
                  <li key={`${window.date}:${window.period}`}>
                    {formatWindowDay(window.date)}, {window.periodLabel.toLowerCase()}
                  </li>
                ))}
              </ul>
            )
          }
          note={`The client's time zone is ${appointment.timeZone}.`}
        />
        {appointment.eventDate !== null ? (
          <OrderBookRow label="Event date" value={formatDate(appointment.eventDate)} />
        ) : null}
        {appointment.notes ? (
          <OrderBookRow label="Notes" value={<span className="whitespace-pre-wrap">{appointment.notes}</span>} />
        ) : null}
        {appointment.accessibility ? (
          <OrderBookRow
            label="Accessibility"
            value={<span className="whitespace-pre-wrap">{appointment.accessibility}</span>}
          />
        ) : null}
        <OrderBookRow
          label="Booking reference"
          value={
            appointment.recordedCalendarRef ? (
              <Mono upper={false}>{appointment.recordedCalendarRef}</Mono>
            ) : (
              <span className="text-muted-foreground">Not recorded</span>
            )
          }
          note={
            appointment.recordedCalendarRef &&
            (appointment.status === "rescheduled" || appointment.status === "cancelled")
              ? "From a booking the client no longer holds: clear it in Square Appointments. A new confirmation needs a new reference."
              : undefined
          }
        />
      </OrderBook>

      {canConfirm ? <ConfirmForm appointment={appointment} /> : null}
      {canComplete ? <CompleteControl appointment={appointment} /> : null}

      {appointment.history.length > 0 ? (
        <div>
          <h3 className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">History</h3>
          <ol className="mt-2 divide-y divide-foreground/10 border-y border-foreground/15 text-sm">
            {[...appointment.history].reverse().map((entry, index) => (
              <li
                key={`${entry.at}-${index}`}
                className="grid gap-x-6 gap-y-0.5 py-2 sm:grid-cols-[minmax(7rem,11rem)_1fr]"
              >
                <Mono upper={false} className="text-[11px] text-foreground/80">
                  {formatDateTime(entry.at)}
                </Mono>
                <span>
                  {entry.from === entry.to
                    ? APPOINTMENT_STATUS_LABELS[entry.to]
                    : `${APPOINTMENT_STATUS_LABELS[entry.from]} → ${APPOINTMENT_STATUS_LABELS[entry.to]}`}{" "}
                  by {entry.by === "staff" ? "the house" : entry.by === "client" ? "the client" : "the system"}
                  {entry.note ? <span className="text-muted-foreground"> · {entry.note}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

function ConfirmForm({ appointment }: { appointment: StaffAppointmentRow }) {
  const confirm = useMutation(api.atelier.appointments.confirm);
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [start, setStart] = useState(
    appointment.confirmedStart !== null ? toLocalInput(appointment.confirmedStart) : "",
  );
  const [end, setEnd] = useState(appointment.confirmedEnd !== null ? toLocalInput(appointment.confirmedEnd) : "");
  // A reference left from a released booking is the one to clear, never one to confirm a new time with.
  const [calendarRef, setCalendarRef] = useState(appointment.confirmed ? (appointment.recordedCalendarRef ?? "") : "");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nowInput = useNowInput();
  const startAt = fromLocalInput(start);
  const endAt = fromLocalInput(end);
  const floorAt = nowInput !== undefined ? fromLocalInput(nowInput) : null;
  const orderOk = startAt !== null && endAt !== null && endAt > startAt;
  /** The house confirms a time still to come; the server allows a few minutes' grace, this floor is the minute. */
  const tooEarly = startAt !== null && floorAt !== null && startAt < floorAt;
  const canSubmit = orderOk && !tooEarly && calendarRef.trim().length > 0 && !pending;
  const id = appointment._id;

  async function submit() {
    if (startAt === null || endAt === null) return;
    setPending(true);
    setError(null);
    try {
      await confirm({
        appointmentId: appointment._id,
        confirmedStart: startAt,
        confirmedEnd: endAt,
        calendarRef: calendarRef.trim(),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      toast.success("Confirmed. The client now reads the confirmed time and the booking reference.");
      setNote("");
    } catch (caught) {
      setError(toClientError(caught).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4 border-t border-foreground/10 pt-5">
      <h3 className="text-base font-medium">{appointment.status === "confirmed" ? "Confirm a new time" : "Confirm"}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Times are entered in your browser&rsquo;s zone ({browserZone}) and shown to the client in theirs (
        {appointment.timeZone}). Confirmed requires the Square Appointments booking reference; book it there first.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`start-${id}`}>Starts</FieldLabel>
          <Input
            id={`start-${id}`}
            type="datetime-local"
            min={nowInput}
            value={start}
            onChange={(event) => {
              setStart(event.target.value);
              const at = fromLocalInput(event.target.value);
              if (at !== null && !end) setEnd(toLocalInput(at + HOUR_MS));
            }}
            aria-invalid={tooEarly || undefined}
          />
          {tooEarly ? (
            <FieldDescription className="text-destructive">
              That start time has already passed; confirm a time still to come.
            </FieldDescription>
          ) : null}
        </Field>
        <Field>
          <FieldLabel htmlFor={`end-${id}`}>Ends</FieldLabel>
          <Input
            id={`end-${id}`}
            type="datetime-local"
            min={nowInput}
            value={end}
            onChange={(event) => setEnd(event.target.value)}
            aria-invalid={Boolean(start && end && !orderOk)}
          />
          {start && end && !orderOk ? (
            <FieldDescription className="text-destructive">The appointment must end after it starts.</FieldDescription>
          ) : null}
        </Field>
        <Field>
          <FieldLabel htmlFor={`ref-${id}`}>Square booking reference</FieldLabel>
          <FieldDescription>Required. Without it the appointment stays requested.</FieldDescription>
          <Input
            id={`ref-${id}`}
            value={calendarRef}
            onChange={(event) => setCalendarRef(event.target.value)}
            autoComplete="off"
            className="font-mono"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`note-${id}`}>Note for the client</FieldLabel>
          <FieldDescription>Optional; added to the confirmation message.</FieldDescription>
          <Input id={`note-${id}`} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
      </div>
      {startAt !== null ? (
        <p className="text-sm leading-relaxed">
          The client will read:{" "}
          <span className="font-medium">
            Confirmed for {formatInZone(startAt, appointment.timeZone)} ({appointment.timeZone})
          </span>
          .
        </p>
      ) : null}
      {error ? <ErrorAlert title="The appointment was not confirmed" message={error} /> : null}
      <Button className="h-10 rounded-none px-5" disabled={!canSubmit} onClick={() => void submit()}>
        {pending ? <Spinner data-icon="inline-start" /> : null}
        Confirm with booking reference
      </Button>
    </div>
  );
}

function CompleteControl({ appointment }: { appointment: StaffAppointmentRow }) {
  const complete = useMutation(api.atelier.appointments.complete);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      await complete({ appointmentId: appointment._id, ...(note.trim() ? { note: note.trim() } : {}) });
      toast.success("Marked as completed.");
      setNote("");
    } catch (caught) {
      setError(toClientError(caught).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-foreground/10 pt-5">
      <h3 className="text-base font-medium">After the appointment</h3>
      <Field>
        <FieldLabel htmlFor={`complete-${appointment._id}`}>Note</FieldLabel>
        <FieldDescription>Optional; recorded on the request.</FieldDescription>
        <Input id={`complete-${appointment._id}`} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      {error ? <ErrorAlert title="The appointment was not completed" message={error} /> : null}
      <Button variant="outline" className="h-10 rounded-none px-5" disabled={pending} onClick={() => void submit()}>
        {pending ? <Spinner data-icon="inline-start" /> : null}
        Mark completed
      </Button>
    </div>
  );
}
