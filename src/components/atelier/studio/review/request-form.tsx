"use client";

import { useMutation } from "convex/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useId, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { CASE_KIND_LABELS, CONTACT_CHANNELS, type ContactChannel } from "@convex/shared/atelier/enums";
import { HOUSE_POLICY } from "@convex/shared/atelier/policy";
import { SHOWROOMS, type ShowroomId } from "@convex/shared/house";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { reportError, type ClientError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

type RequestKind = "quote" | "design_review";

const CHANNEL_LABELS: Record<ContactChannel, string> = { email: "Email", sms: "Text message", either: "Either" };
const NO_PREFERENCE = "none";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MESSAGE_MAX = 2000;

type ContactDraft = {
  name: string;
  email: string;
  phone: string;
  preferredShowroom: ShowroomId | typeof NO_PREFERENCE;
  channel: ContactChannel;
};

type FieldErrors = Partial<Record<"name" | "email" | "phone" | "consent", string>>;

function validate(contact: ContactDraft, consent: boolean): FieldErrors {
  const errors: FieldErrors = {};
  if (!contact.name.trim()) errors.name = "Add your name.";
  if (!EMAIL_PATTERN.test(contact.email.trim())) errors.email = "Enter an email address the house can reply to.";
  if (contact.channel === "sms" && !contact.phone.trim()) {
    errors.phone = "Add a phone number to be reached by text, or choose email.";
  }
  if (!consent) errors.consent = "Tick this so the house may reply to you.";
  return errors;
}

/** One key per form instance, reused on every retry so a shaky connection never makes two requests. */
function newSubmissionKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Base UI reads the trigger's words from here, so the first paint says "No preference", not "none". */
const SHOWROOM_ITEMS: Record<string, string> = {
  [NO_PREFERENCE]: "No preference",
  ...Object.fromEntries(SHOWROOMS.map((showroom) => [showroom.id, showroom.city])),
};

function isShowroom(value: unknown): value is ShowroomId {
  return typeof value === "string" && SHOWROOMS.some((showroom) => showroom.id === value);
}

type Props = {
  draftId: Id<"atelierDrafts">;
  guestKeyArg: { guestKey?: string };
  /** What still stops the design being sent; both actions stay disabled while any remain. */
  holds: string[];
  /** The design has been sent before: say so; sending again is a new request with the same design. */
  alreadySubmitted: boolean;
};

/**
 * The request (S24 → S25, C19): contact, a message and consent, then one primary action for a quote
 * and a quiet one for a design review first. The server receives one request per submission key, so a
 * retry after a failure sends the same key; a duplicate answer is a success. Nothing here orders, prices
 * or books anything, and the words say so.
 */
export function RequestForm({ draftId, guestKeyArg, holds, alreadySubmitted }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const submit = useMutation(api.atelier.cases.submit);
  const ids = useId();

  const [contact, setContact] = useState<ContactDraft>({
    name: "",
    email: "",
    phone: "",
    preferredShowroom: NO_PREFERENCE,
    channel: "email",
  });
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [submissionKey] = useState(newSubmissionKey);
  const [attempted, setAttempted] = useState(false);
  const [pending, setPending] = useState<RequestKind | null>(null);
  const [failure, setFailure] = useState<{ error: ClientError; kind: RequestKind } | null>(null);
  const [received, setReceived] = useState<{
    caseId: Id<"atelierCases">;
    kind: RequestKind;
    duplicate: boolean;
  } | null>(null);

  const errors = validate(contact, consent);
  const shownErrors: FieldErrors = attempted ? errors : {};
  const held = holds.length > 0;
  const busy = pending !== null;
  const done = received !== null;
  const disabled = held || busy || done;

  const update = <K extends keyof ContactDraft>(key: K, value: ContactDraft[K]) =>
    setContact((current) => ({ ...current, [key]: value }));

  async function send(kind: RequestKind) {
    setAttempted(true);
    if (Object.keys(errors).length > 0 || disabled) return;
    setPending(kind);
    setFailure(null);
    try {
      const result = await submit({
        ...guestKeyArg,
        kind,
        draftId,
        contact: {
          name: contact.name.trim(),
          email: contact.email.trim(),
          ...(contact.phone.trim() ? { phone: contact.phone.trim() } : {}),
          ...(contact.preferredShowroom !== NO_PREFERENCE ? { preferredShowroom: contact.preferredShowroom } : {}),
          channel: contact.channel,
        },
        ...(message.trim() ? { message: message.trim() } : {}),
        submissionKey,
      });
      setReceived({ caseId: result.caseId, kind, duplicate: result.duplicate });
      router.push(routes.atelier.request(result.caseId));
    } catch (error) {
      setFailure({ error: reportError(error), kind });
    } finally {
      setPending(null);
    }
  }

  if (received) {
    return (
      <div className="space-y-3 border-y border-foreground/15 py-5" aria-live="polite">
        <StatusLine tone="gold" live>
          Request received
        </StatusLine>
        <p className="text-sm">
          <span className="text-muted-foreground">{CASE_KIND_LABELS[received.kind]} · </span>
          <Mono className="text-foreground">{received.caseId}</Mono>
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {received.duplicate
            ? "The house already had this request; nothing was sent twice."
            : "Your design was sent as it stands. Nothing is ordered and no price is set until you approve a quote."}{" "}
          Opening your request…
        </p>
        <Button
          variant="outline"
          className="h-11 rounded-none px-4"
          nativeButton={false}
          render={<Link href={routes.atelier.request(received.caseId)} />}
        >
          Open your request
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void send("quote");
      }}
    >
      {alreadySubmitted ? (
        <StatusLine tone="neutral" className="text-pretty">
          This design has been sent to the house before. Sending again makes a new request with the design as it is now.
        </StatusLine>
      ) : null}

      <FieldSet className="gap-5">
        <FieldLegend variant="label">How the house reaches you</FieldLegend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={shownErrors.name ? true : undefined}>
            <FieldLabel htmlFor={`${ids}-name`}>Name</FieldLabel>
            <Input
              id={`${ids}-name`}
              value={contact.name}
              onChange={(event) => update("name", event.target.value)}
              autoComplete="name"
              maxLength={120}
              aria-invalid={shownErrors.name ? true : undefined}
              className="h-11 rounded-none"
              disabled={busy}
            />
            <FieldError>{shownErrors.name}</FieldError>
          </Field>
          <Field data-invalid={shownErrors.email ? true : undefined}>
            <FieldLabel htmlFor={`${ids}-email`}>Email</FieldLabel>
            <Input
              id={`${ids}-email`}
              type="email"
              inputMode="email"
              value={contact.email}
              onChange={(event) => update("email", event.target.value)}
              autoComplete="email"
              aria-invalid={shownErrors.email ? true : undefined}
              className="h-11 rounded-none"
              disabled={busy}
            />
            <FieldError>{shownErrors.email}</FieldError>
          </Field>
          <Field data-invalid={shownErrors.phone ? true : undefined}>
            <FieldLabel htmlFor={`${ids}-phone`}>
              Phone{" "}
              <span className="font-normal text-muted-foreground">
                {contact.channel === "sms" ? "(for texts)" : "(optional)"}
              </span>
            </FieldLabel>
            <Input
              id={`${ids}-phone`}
              type="tel"
              inputMode="tel"
              value={contact.phone}
              onChange={(event) => update("phone", event.target.value)}
              autoComplete="tel"
              maxLength={40}
              aria-invalid={shownErrors.phone ? true : undefined}
              className="h-11 rounded-none"
              disabled={busy}
            />
            <FieldError>{shownErrors.phone}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${ids}-showroom`}>
              Preferred showroom <span className="font-normal text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Select
              items={SHOWROOM_ITEMS}
              value={contact.preferredShowroom}
              onValueChange={(value) => update("preferredShowroom", isShowroom(value) ? value : NO_PREFERENCE)}
              disabled={busy}
            >
              <SelectTrigger id={`${ids}-showroom`} className="h-11 w-full rounded-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value={NO_PREFERENCE}>No preference</SelectItem>
                {SHOWROOMS.map((showroom) => (
                  <SelectItem key={showroom.id} value={showroom.id}>
                    {showroom.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <FieldSet>
          <FieldLegend variant="label" className="text-sm font-medium">
            Reply by
          </FieldLegend>
          <RadioGroup
            value={contact.channel}
            onValueChange={(value) => {
              if (typeof value === "string" && (CONTACT_CHANNELS as readonly string[]).includes(value)) {
                update("channel", value as ContactChannel);
              }
            }}
            className="flex flex-wrap gap-x-6 gap-y-1"
            aria-label="Reply by"
            disabled={busy}
          >
            {CONTACT_CHANNELS.map((channel) => (
              <FieldLabel key={channel} className="flex min-h-11 cursor-pointer items-center gap-2 font-normal">
                <RadioGroupItem value={channel} />
                <span className="text-sm">{CHANNEL_LABELS[channel]}</span>
              </FieldLabel>
            ))}
          </RadioGroup>
        </FieldSet>
      </FieldSet>

      <Field>
        <FieldLabel htmlFor={`${ids}-message`}>
          A note for your concierge <span className="font-normal text-muted-foreground">(optional)</span>
        </FieldLabel>
        <Textarea
          id={`${ids}-message`}
          value={message}
          onChange={(event) => setMessage(event.target.value.slice(0, MESSAGE_MAX))}
          rows={3}
          maxLength={MESSAGE_MAX}
          placeholder="Anything the design does not say: the occasion's dress code, a question about the cloth, when you could visit."
          className="min-h-24 rounded-none"
          disabled={busy}
        />
        <FieldDescription>Your design goes with the request exactly as it reads above.</FieldDescription>
      </Field>

      <Field data-invalid={shownErrors.consent ? true : undefined}>
        <FieldLabel className="flex min-h-11 w-full cursor-pointer items-start gap-3 font-normal">
          <Checkbox
            checked={consent}
            onCheckedChange={(checked) => setConsent(checked === true)}
            disabled={busy}
            aria-invalid={shownErrors.consent ? true : undefined}
            className="mt-0.5"
          />
          <span className="text-sm leading-relaxed">
            The house may contact me about this request at the details above. Nothing else is sent, and no marketing
            follows from it.
          </span>
        </FieldLabel>
        <FieldError>{shownErrors.consent}</FieldError>
      </Field>

      {failure ? (
        <ErrorAlert
          title={`The ${CASE_KIND_LABELS[failure.kind].toLowerCase()} was not sent`}
          message={
            failure.error.code === "UNAUTHENTICATED" ? (
              <>
                {failure.error.message}{" "}
                <Link
                  href={`${routes.signIn}?redirect_url=${encodeURIComponent(pathname)}`}
                  className="underline underline-offset-4"
                >
                  Sign in
                </Link>{" "}
                and your details will be here.
              </>
            ) : (
              `${failure.error.message} Your details are still here.`
            )
          }
          onRetry={
            failure.error.code === "INVALID_STATE" || failure.error.code === "UNAUTHENTICATED"
              ? undefined
              : () => void send(failure.kind)
          }
          retryLabel="Send again"
          className="rounded-none"
        />
      ) : null}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" className="h-11 rounded-none px-5" disabled={disabled}>
            {pending === "quote" ? <Spinner data-icon="inline-start" aria-label="Sending" /> : null}
            Request a quote
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 rounded-none px-3 underline underline-offset-4"
            onClick={() => void send("design_review")}
            disabled={disabled}
          >
            {pending === "design_review" ? <Spinner data-icon="inline-start" aria-label="Sending" /> : null}
            Ask for a design review first
          </Button>
        </div>
        {held ? (
          <div role="status" className={cn("space-y-1 text-xs leading-relaxed text-muted-foreground")}>
            <p className="font-medium text-foreground">Before this can be sent:</p>
            <ul className="list-disc space-y-0.5 pl-4">
              {holds.map((hold) => (
                <li key={hold}>{hold}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-muted-foreground">
            A quote request is not a purchase and not a booking. A concierge prices the design as submitted and offers a
            quote for your approval; a design review is a conversation first. {HOUSE_POLICY.proposed.responseTime}
          </p>
        )}
      </div>
    </form>
  );
}
