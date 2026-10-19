"use client";

import { useMutation } from "convex/react";
import { useId, useState } from "react";
import { toast } from "sonner";
import {
  emptyWindow,
  PreferredWindowsField,
  toPreferredWindows,
  utcToDay,
  windowProblem,
  type WindowDraft,
} from "@/components/atelier/fittings/preferred-windows-field";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useGuestKeyArg } from "@/hooks/atelier/use-owner-args";
import { reportError, type ClientError } from "@/lib/errors";
import { api } from "@convex/_generated/api";
import type { AppointmentView } from "@convex/atelier/appointments";
import { APPOINTMENT_STATUS_LABELS } from "@convex/shared/atelier/enums";

/** C18 step 3: new preferred windows. Any confirmed time is released and the house confirms again. */
export function RescheduleForm({
  appointment,
  onDone,
  onCancel,
}: {
  appointment: AppointmentView;
  onDone: () => void;
  onCancel: () => void;
}) {
  const ids = useId();
  const guestKeyArg = useGuestKeyArg();
  const reschedule = useMutation(api.atelier.appointments.reschedule);
  const [windows, setWindows] = useState<WindowDraft[]>(() =>
    appointment.preferredWindows.length > 0
      ? appointment.preferredWindows.map((item) => ({
          ...emptyWindow(),
          date: utcToDay(item.date),
          period: item.period,
        }))
      : [emptyWindow()],
  );
  const [note, setNote] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ClientError | null>(null);

  async function send() {
    setAttempted(true);
    if (windows.length === 0 || windows.some((item) => windowProblem(item) !== null)) return;
    setPending(true);
    setFailure(null);
    try {
      await reschedule({
        ...guestKeyArg,
        appointmentId: appointment._id,
        preferredWindows: toPreferredWindows(windows),
        note: note.trim() || undefined,
      });
      toast.success(APPOINTMENT_STATUS_LABELS.rescheduled);
      onDone();
    } catch (error) {
      setFailure(reportError(error, "The new windows were not sent."));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="max-w-3xl space-y-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <PreferredWindowsField
        legend="New preferred windows"
        windows={windows}
        onChange={setWindows}
        disabled={pending}
        showErrors={attempted}
      />
      <Field>
        <FieldLabel htmlFor={`${ids}-note`}>
          A note for the house <span className="font-normal text-muted-foreground">(optional)</span>
        </FieldLabel>
        <Textarea
          id={`${ids}-note`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="min-h-20 rounded-none"
          disabled={pending}
        />
      </Field>
      {failure ? (
        <ErrorAlert
          title="The new windows were not sent"
          message={failure.message}
          onRetry={failure.code === "INVALID_INPUT" || failure.code === "INVALID_STATE" ? undefined : () => void send()}
          retryLabel="Send again"
          className="rounded-none"
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="h-11 rounded-none px-5" disabled={pending} aria-busy={pending}>
          {pending ? <Spinner data-icon="inline-start" aria-label="Sending" /> : null}
          {pending ? "Sending…" : "Send the new windows"}
        </Button>
        <Button type="button" variant="ghost" className="h-11 rounded-none px-4" onClick={onCancel} disabled={pending}>
          Keep the current request
        </Button>
      </div>
      <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
        {appointment.confirmed
          ? "Sending releases the confirmed time. The appointment reads “Rescheduled · awaiting confirmation” until the house confirms again."
          : "The appointment reads “Rescheduled · awaiting confirmation” until the house confirms a time."}
      </p>
    </form>
  );
}
