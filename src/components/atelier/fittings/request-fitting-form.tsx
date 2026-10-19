"use client";

import { useMutation } from "convex/react";
import Link from "next/link";
import { useId, useState, useSyncExternalStore } from "react";
import { ChoiceList, ChoiceRow } from "@/components/atelier/fit/choice-list";
import { signInHref } from "@/components/atelier/fit/fit-words";
import { SERVICE_NOTES, VIRTUAL_SERVICES } from "@/components/atelier/fittings/appointment-words";
import {
  emptyWindow,
  PreferredWindowsField,
  toPreferredWindows,
  windowProblem,
  type WindowDraft,
} from "@/components/atelier/fittings/preferred-windows-field";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useGuestKeyArg } from "@/hooks/atelier/use-owner-args";
import { reportError, type ClientError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { AppointmentLocation, RequestResult } from "@convex/atelier/appointments";
import {
  APPOINTMENT_SERVICE_LABELS,
  APPOINTMENT_SERVICES,
  CONTACT_CHANNELS,
  type AppointmentService,
  type ContactChannel,
} from "@convex/shared/atelier/enums";
import { HOUSE, SHOWROOMS } from "@convex/shared/house";

const CHANNEL_LABELS: Record<ContactChannel, string> = { email: "Email", sms: "Text message", either: "Either" };
const VIRTUAL = "virtual" satisfies AppointmentLocation;

const noSubscription = () => () => {};
/** The device's zone, read on the client only; the server renders an empty value and the browser fills it in. */
function useDeviceTimeZone(): string {
  return useSyncExternalStore(
    noSubscription,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    () => "",
  );
}

type Values = {
  service: AppointmentService | "";
  showroomId: AppointmentLocation | "";
  windows: WindowDraft[];
  notes: string;
  accessibility: string;
  /** Null until the client changes it: the device's zone is used. */
  timeZone: string | null;
  eventDate: string;
  name: string;
  email: string;
  phone: string;
  channel: ContactChannel;
};

type TextKey = "notes" | "accessibility" | "timeZone" | "eventDate" | "name" | "email" | "phone";
type ErrorKey = Exclude<keyof Values, "windows"> | "windows";

function initialValues(): Values {
  return {
    service: "",
    showroomId: "",
    windows: [emptyWindow()],
    notes: "",
    accessibility: "",
    timeZone: null,
    eventDate: "",
    name: "",
    email: "",
    phone: "",
    channel: "email",
  };
}

/** A date input's value as local noon, as the occasion step stores an event date. */
function eventDayToTimestamp(value: string): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const timestamp = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12).getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function virtualAllowed(service: AppointmentService | ""): boolean {
  return service !== "" && VIRTUAL_SERVICES.includes(service);
}

type Resolved = Omit<Values, "timeZone"> & { timeZone: string };

function validate(values: Resolved): Partial<Record<ErrorKey, string>> {
  const errors: Partial<Record<ErrorKey, string>> = {};
  if (!values.service) errors.service = "Choose the service you are asking for.";
  if (!values.showroomId) errors.showroomId = "Choose a showroom, or by video where the service allows it.";
  else if (values.showroomId === VIRTUAL && values.service && !virtualAllowed(values.service)) {
    errors.showroomId = `${APPOINTMENT_SERVICE_LABELS[values.service]} happens at a showroom; choose Charlotte, Atlanta or Houston.`;
  }
  if (values.windows.length === 0 || values.windows.some((item) => windowProblem(item) !== null)) {
    errors.windows = "Each preferred window needs a day from tomorrow onward and a time of day.";
  }
  if (!values.timeZone.trim()) errors.timeZone = "Tell us your time zone so times are shown correctly.";
  if (values.eventDate && eventDayToTimestamp(values.eventDate) === undefined)
    errors.eventDate = "Enter a date, or leave it empty.";
  if (!values.name.trim()) errors.name = "Your name is needed so the house knows who is coming.";
  if (!values.email.trim()) errors.email = "An email address is needed for the confirmation.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
    errors.email = "Enter an email address we can write to.";
  if ((values.channel === "sms" || values.channel === "either") && !values.phone.trim()) {
    errors.phone = "Add a number we can text, or choose email.";
  }
  return errors;
}

type Props = {
  draftId?: Id<"atelierDrafts">;
  caseId?: Id<"atelierCases">;
  onRequested: (result: RequestResult) => void;
  onCancel?: () => void;
};

/**
 * S22 (C18): a durable pending request, never a booking. One `submissionKey` per form instance is
 * reused on every retry so poor connectivity cannot create two requests; the house confirms a real
 * time afterwards and the words stay "Requested · awaiting confirmation" until it does.
 */
export function RequestFittingForm({ draftId, caseId, onRequested, onCancel }: Props) {
  const ids = useId();
  const guestKeyArg = useGuestKeyArg();
  const request = useMutation(api.atelier.appointments.request);
  const [submissionKey] = useState(() => crypto.randomUUID());
  const [values, setValues] = useState<Values>(initialValues);
  const [attempted, setAttempted] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ClientError | null>(null);
  const deviceZone = useDeviceTimeZone();

  const resolved: Resolved = { ...values, timeZone: values.timeZone ?? deviceZone };
  const errors = validate(resolved);
  const shown = attempted ? errors : {};
  const update = <K extends keyof Values>(key: K, value: Values[K]) => setValues((prev) => ({ ...prev, [key]: value }));

  function chooseService(service: AppointmentService) {
    setValues((prev) => {
      let showroomId = prev.showroomId;
      if (service === "virtual") showroomId = VIRTUAL;
      else if (showroomId === VIRTUAL && !virtualAllowed(service)) showroomId = "";
      return { ...prev, service, showroomId };
    });
  }

  async function send() {
    setAttempted(true);
    if (Object.keys(errors).length > 0 || !resolved.service || !resolved.showroomId) return;
    setPending(true);
    setFailure(null);
    const phone = resolved.phone.trim();
    const showroomId = resolved.showroomId;
    try {
      const result = await request({
        ...guestKeyArg,
        ...(draftId ? { draftId } : {}),
        ...(caseId ? { caseId } : {}),
        service: resolved.service,
        showroomId,
        preferredWindows: toPreferredWindows(resolved.windows),
        notes: resolved.notes.trim() || undefined,
        accessibility: resolved.accessibility.trim() || undefined,
        timeZone: resolved.timeZone.trim(),
        eventDate: resolved.eventDate ? eventDayToTimestamp(resolved.eventDate) : undefined,
        contact: {
          name: resolved.name.trim(),
          email: resolved.email.trim(),
          ...(phone ? { phone } : {}),
          ...(showroomId !== "virtual" ? { preferredShowroom: showroomId } : {}),
          channel: resolved.channel,
        },
        submissionKey,
      });
      onRequested(result);
    } catch (error) {
      setFailure(reportError(error, "The request was not sent."));
    } finally {
      setPending(false);
    }
  }

  const text = (
    key: TextKey,
    label: string,
    options: { type?: string; autoComplete?: string; optional?: boolean; description?: string; min?: string } = {},
  ) => (
    <Field data-invalid={shown[key] ? true : undefined}>
      <FieldLabel htmlFor={`${ids}-${key}`}>
        {label}
        {options.optional ? <span className="font-normal text-muted-foreground">(optional)</span> : null}
      </FieldLabel>
      {options.description ? <FieldDescription>{options.description}</FieldDescription> : null}
      <Input
        id={`${ids}-${key}`}
        type={options.type ?? "text"}
        autoComplete={options.autoComplete}
        min={options.min}
        value={resolved[key]}
        onChange={(event) => update(key, event.target.value)}
        aria-invalid={shown[key] ? true : undefined}
        className="h-11 rounded-none"
        disabled={pending}
      />
      {shown[key] ? <FieldError>{shown[key]}</FieldError> : null}
    </Field>
  );

  return (
    <form
      className="max-w-3xl space-y-10"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <FieldSet>
        <FieldLegend variant="label">
          Service{" "}
          <span className="text-primary" aria-hidden>
            *
          </span>
        </FieldLegend>
        <ChoiceList
          value={values.service}
          onValueChange={(value) => chooseService(value as AppointmentService)}
          aria-label="Service"
          disabled={pending}
        >
          {APPOINTMENT_SERVICES.map((service) => (
            <ChoiceRow
              key={service}
              id={`${ids}-service-${service}`}
              value={service}
              title={APPOINTMENT_SERVICE_LABELS[service]}
              description={SERVICE_NOTES[service]}
            />
          ))}
        </ChoiceList>
        {shown.service ? <FieldError>{shown.service}</FieldError> : null}
      </FieldSet>

      <FieldSet>
        <FieldLegend variant="label">
          Where{" "}
          <span className="text-primary" aria-hidden>
            *
          </span>
        </FieldLegend>
        <FieldDescription>{HOUSE.hours}</FieldDescription>
        <ChoiceList
          value={values.showroomId}
          onValueChange={(value) => update("showroomId", value as AppointmentLocation)}
          aria-label="Showroom"
          disabled={pending}
        >
          {SHOWROOMS.map((showroom) => (
            <ChoiceRow
              key={showroom.id}
              id={`${ids}-showroom-${showroom.id}`}
              value={showroom.id}
              title={showroom.city}
              description={showroom.address}
              detail={showroom.phone}
              disabled={values.service === "virtual"}
              reason={values.service === "virtual" ? "A virtual appointment happens by video." : null}
            />
          ))}
          <ChoiceRow
            id={`${ids}-showroom-virtual`}
            value={VIRTUAL}
            title="By video"
            description="For a private consultation or a virtual appointment."
            disabled={values.service !== "" && !virtualAllowed(values.service)}
            reason={
              values.service !== "" && !virtualAllowed(values.service)
                ? `${APPOINTMENT_SERVICE_LABELS[values.service]} happens at a showroom.`
                : null
            }
          />
        </ChoiceList>
        {shown.showroomId ? <FieldError>{shown.showroomId}</FieldError> : null}
      </FieldSet>

      <div className="space-y-2">
        <PreferredWindowsField
          windows={values.windows}
          onChange={(windows) => update("windows", windows)}
          disabled={pending}
          showErrors={attempted}
        />
      </div>

      <FieldSet>
        <FieldLegend variant="label">Timing</FieldLegend>
        <FieldGroup>
          {text("eventDate", "The date the suit is for", {
            type: "date",
            optional: true,
            description: "If the suit is for an occasion, the house plans the fittings around it.",
          })}
          {text("timeZone", "Your time zone", {
            description:
              "Read from this device. Change it if you will be somewhere else; confirmed times are shown in it.",
            autoComplete: "off",
          })}
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend variant="label">Anything the house should know</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${ids}-notes`}>
              Notes <span className="font-normal text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Textarea
              id={`${ids}-notes`}
              value={values.notes}
              onChange={(event) => update("notes", event.target.value)}
              className="min-h-20 rounded-none"
              disabled={pending}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${ids}-accessibility`}>
              Access needs <span className="font-normal text-muted-foreground">(optional)</span>
            </FieldLabel>
            <FieldDescription>
              Step-free access, seating, an interpreter, more time: tell us and the showroom prepares.
            </FieldDescription>
            <Textarea
              id={`${ids}-accessibility`}
              value={values.accessibility}
              onChange={(event) => update("accessibility", event.target.value)}
              className="min-h-20 rounded-none"
              disabled={pending}
            />
          </Field>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend variant="label">How to reach you</FieldLegend>
        <FieldGroup>
          {text("name", "Name", { autoComplete: "name" })}
          {text("email", "Email", { type: "email", autoComplete: "email" })}
          {text("phone", "Phone", { type: "tel", autoComplete: "tel", optional: values.channel === "email" })}
          <Field data-invalid={shown.channel ? true : undefined}>
            <FieldLabel>Confirm by</FieldLabel>
            <RadioGroup
              value={values.channel}
              onValueChange={(value) => update("channel", value as ContactChannel)}
              className="flex flex-wrap gap-x-5 gap-y-2"
              aria-label="How the house confirms the time"
              disabled={pending}
            >
              {CONTACT_CHANNELS.map((channel) => (
                <FieldLabel key={channel} className="min-h-11 items-center font-normal">
                  <RadioGroupItem value={channel} disabled={pending} />
                  {CHANNEL_LABELS[channel]}
                </FieldLabel>
              ))}
            </RadioGroup>
          </Field>
        </FieldGroup>
      </FieldSet>

      {failure ? (
        <ErrorAlert
          title="The fitting request was not sent"
          message={
            <>
              {failure.message}
              {failure.code === "UNAUTHENTICATED" ? (
                <>
                  {" "}
                  <Link href={signInHref(routes.atelier.fittings)} className="underline underline-offset-4">
                    Sign in
                  </Link>
                </>
              ) : null}
            </>
          }
          onRetry={failure.code === "INVALID_INPUT" || failure.code === "RATE_LIMITED" ? undefined : () => void send()}
          retryLabel="Send again"
          className="rounded-none"
        />
      ) : null}

      <div className="space-y-3 border-t border-foreground/15 pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" className="h-11 rounded-none px-5" disabled={pending} aria-busy={pending}>
            {pending ? <Spinner data-icon="inline-start" aria-label="Sending" /> : null}
            {pending ? "Sending…" : "Request this fitting"}
          </Button>
          {onCancel ? (
            <Button
              type="button"
              variant="ghost"
              className="h-11 rounded-none px-4"
              onClick={onCancel}
              disabled={pending}
            >
              Cancel
            </Button>
          ) : null}
        </div>
        <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Sending a request does not book a time. A concierge confirms a real time with you and records the booking;
          until then the request reads “Requested · awaiting confirmation”.
        </p>
      </div>
    </form>
  );
}
