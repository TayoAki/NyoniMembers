"use client";

import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useId, useState } from "react";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
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
import { useGuestKeyArg } from "@/hooks/atelier/use-owner-args";
import { toClientError, type ClientError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { CONTACT_CHANNEL_LABELS, CONTACT_CHANNELS, type ContactChannel } from "@convex/shared/atelier/enums";
import { HOUSE } from "@convex/shared/house";

type SubmitArgs = FunctionArgs<typeof api.atelier.cases.submit>;
type SubmitResult = FunctionReturnType<typeof api.atelier.cases.submit>;

type FormValues = {
  name: string;
  email: string;
  phone: string;
  channel: ContactChannel;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
};

const EMPTY: FormValues = {
  name: "",
  email: "",
  phone: "",
  channel: "email",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "United States",
};

type FieldKey = keyof FormValues;

function validate(values: FormValues): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {};
  if (!values.name.trim()) errors.name = "Your name is needed to address the sample.";
  if (!values.email.trim()) errors.email = "An email address is needed for the confirmation.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
    errors.email = "Enter an email address we can write to.";
  if ((values.channel === "sms" || values.channel === "either") && !values.phone.trim())
    errors.phone = "Add a number we can text, or choose email.";
  if (!values.line1.trim()) errors.line1 = "The street address is needed to post the sample.";
  if (!values.city.trim()) errors.city = "Add the city.";
  if (!values.region.trim()) errors.region = "Add the state or region.";
  if (!values.postalCode.trim()) errors.postalCode = "Add the postal code.";
  if (!values.country.trim()) errors.country = "Add the country.";
  return errors;
}

function submitErrorMessage(error: ClientError): string {
  switch (error.code) {
    case "RATE_LIMITED":
      return `You have reached today's limit for requests. Try again tomorrow, or write to the house at ${HOUSE.concierge.email}.`;
    case "NOT_FOUND":
      return "This cloth is no longer in the house's catalogue, so a sample cannot be sent.";
    case "INVALID_INPUT":
    case "INVALID_STATE":
    case "UNAUTHENTICATED":
      return error.message;
    default:
      return "The request did not reach the house. Your details are still here — try again.";
  }
}

type SampleRequestFormProps = {
  clothCode: string;
  clothName: string;
  draftId: Id<"atelierDrafts">;
};

/**
 * Request a physical sample of a cloth (S04, C04). The address is asked only here, for posting the
 * sample; one submissionKey per form instance makes a retry idempotent, and the receipt says
 * "received", never "shipped".
 */
export function SampleRequestForm({ clothCode, clothName, draftId }: SampleRequestFormProps) {
  const submit = useMutation(api.atelier.cases.submit);
  const guestKeyArg = useGuestKeyArg();
  const ids = {
    name: useId(),
    email: useId(),
    phone: useId(),
    line1: useId(),
    line2: useId(),
    city: useId(),
    region: useId(),
    postalCode: useId(),
    country: useId(),
  };
  const [submissionKey] = useState(() => crypto.randomUUID());
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [attempted, setAttempted] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ClientError | null>(null);
  const [receipt, setReceipt] = useState<SubmitResult | null>(null);

  const errors = validate(values);
  const shownErrors = attempted ? errors : {};
  const valid = Object.keys(errors).length === 0;

  function update<K extends FieldKey>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function send() {
    setAttempted(true);
    if (!valid) return;
    setPending(true);
    setFailure(null);
    const args: SubmitArgs = {
      ...guestKeyArg,
      kind: "sample",
      draftId,
      contact: {
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim() || undefined,
        channel: values.channel,
      },
      sample: {
        clothCode,
        address: {
          line1: values.line1.trim(),
          line2: values.line2.trim() || undefined,
          city: values.city.trim(),
          region: values.region.trim(),
          postalCode: values.postalCode.trim(),
          country: values.country.trim(),
        },
      },
      submissionKey,
    };
    try {
      setReceipt(await submit(args));
    } catch (error) {
      setFailure(toClientError(error));
    } finally {
      setPending(false);
    }
  }

  if (receipt) {
    return (
      <div role="status" className="space-y-3 border border-foreground/15 p-4">
        <StatusLine tone="gold">Request received</StatusLine>
        <p className="text-sm">
          A sample of <span className="font-medium">{clothName}</span> has been asked of the house.
        </p>
        <p className="text-xs text-muted-foreground">
          Request <Mono upper={false}>{receipt.caseId}</Mono>
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          A concierge will confirm when it ships. The request is separate from your design: nothing has been ordered.
        </p>
        {receipt.duplicate ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            This matches a request you had already sent, so nothing went to the house twice.
          </p>
        ) : null}
        <Link
          href={routes.atelier.request(receipt.caseId)}
          className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
        >
          See this request
        </Link>
      </div>
    );
  }

  const text = (
    key: Exclude<FieldKey, "channel">,
    label: string,
    options: { type?: string; autoComplete?: string; optional?: boolean } = {},
  ) => (
    <Field data-invalid={shownErrors[key] ? true : undefined}>
      <FieldLabel htmlFor={ids[key]}>
        {label}
        {options.optional ? <span className="font-normal text-muted-foreground">(optional)</span> : null}
      </FieldLabel>
      <Input
        id={ids[key]}
        type={options.type ?? "text"}
        autoComplete={options.autoComplete}
        value={values[key]}
        onChange={(event) => update(key, event.target.value)}
        aria-invalid={shownErrors[key] ? true : undefined}
        className="h-11 rounded-none"
        disabled={pending}
      />
      {shownErrors[key] ? <FieldError>{shownErrors[key]}</FieldError> : null}
    </Field>
  );

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <p className="text-sm leading-relaxed text-muted-foreground">
        A cutting of {clothName} by post, so you can see the real cloth against the representative shade on screen. Your
        address is used only to send it.
      </p>
      <FieldSet>
        <FieldLegend variant="label">How to reach you</FieldLegend>
        <FieldGroup>
          {text("name", "Name", { autoComplete: "name" })}
          {text("email", "Email", { type: "email", autoComplete: "email" })}
          {text("phone", "Phone", { type: "tel", autoComplete: "tel", optional: values.channel === "email" })}
          <Field data-invalid={shownErrors.channel ? true : undefined}>
            <FieldLabel>Confirm by</FieldLabel>
            <RadioGroup
              value={values.channel}
              onValueChange={(value) => update("channel", value as ContactChannel)}
              className="flex flex-wrap gap-x-5 gap-y-2"
              aria-label="How the house confirms the sample"
            >
              {CONTACT_CHANNELS.map((channel) => (
                <FieldLabel key={channel} className="min-h-11 items-center font-normal">
                  <RadioGroupItem value={channel} disabled={pending} />
                  {CONTACT_CHANNEL_LABELS[channel]}
                </FieldLabel>
              ))}
            </RadioGroup>
          </Field>
        </FieldGroup>
      </FieldSet>
      <FieldSet>
        <FieldLegend variant="label">Where to send it</FieldLegend>
        <FieldDescription>Asked only for the sample; the design itself needs no address.</FieldDescription>
        <FieldGroup>
          {text("line1", "Street address", { autoComplete: "address-line1" })}
          {text("line2", "Apartment, suite or floor", { autoComplete: "address-line2", optional: true })}
          <div className="grid gap-5 sm:grid-cols-2">
            {text("city", "City", { autoComplete: "address-level2" })}
            {text("region", "State or region", { autoComplete: "address-level1" })}
            {text("postalCode", "Postal code", { autoComplete: "postal-code" })}
            {text("country", "Country", { autoComplete: "country-name" })}
          </div>
        </FieldGroup>
      </FieldSet>
      {failure ? (
        <ErrorAlert
          title="The sample request was not sent"
          message={
            <>
              {submitErrorMessage(failure)}
              {failure.code === "UNAUTHENTICATED" ? (
                <>
                  {" "}
                  <Link href={routes.signIn} className="underline underline-offset-4">
                    Sign in
                  </Link>
                </>
              ) : null}
            </>
          }
          onRetry={failure.code === "RATE_LIMITED" || failure.code === "NOT_FOUND" ? undefined : () => void send()}
          retryLabel="Send again"
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="h-11 rounded-none px-5" disabled={pending}>
          {pending ? <Spinner data-icon="inline-start" aria-label="Sending" /> : null}
          Request this sample
        </Button>
        <p className="text-xs text-muted-foreground">Sending a request does not order a suit.</p>
      </div>
    </form>
  );
}
