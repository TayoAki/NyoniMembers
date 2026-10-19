"use client";

import { useMutation } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { StatusLine } from "@/components/atelier/common/status-line";
import { MESSAGE_MAX_CHARS } from "@/components/atelier/requests/case-words";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useGuestKeyArg } from "@/hooks/atelier/use-owner-args";
import { reportError, type ClientError } from "@/lib/errors";
import { formatNumber } from "@/lib/format";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { CaseView } from "@convex/atelier/cases";
import { CASE_STATUS_LABELS } from "@convex/shared/atelier/enums";

/**
 * C20: the client's reply. Sending moves the request to "With the house"; a failed send keeps every
 * word in the box and offers to try again. A closed request takes no replies and says so.
 */
export function MessageComposer({ request }: { request: CaseView }) {
  const pathname = usePathname();
  const guestKeyArg = useGuestKeyArg();
  const send = useMutation(api.atelier.cases.sendMessage);
  const id = useId();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<ClientError | null>(null);

  const trimmed = body.trim();
  const tooLong = trimmed.length > MESSAGE_MAX_CHARS;

  if (!request.open) {
    return (
      <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        This request is {request.statusLabel.toLowerCase()}; it no longer takes replies.{" "}
        {request.draftId ? (
          <Link href={routes.atelier.step(request.draftId, "review")} className="underline underline-offset-4">
            Send a new request from your design
          </Link>
        ) : (
          <Link href={routes.atelier.home} className="underline underline-offset-4">
            Start a new design to ask the house again
          </Link>
        )}
        .
      </p>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmed || tooLong || pending) return;
    setPending(true);
    setError(null);
    try {
      await send({ ...guestKeyArg, caseId: request._id, body: trimmed });
      setBody("");
      setSent(true);
    } catch (caught) {
      setError(reportError(caught, "Your message was not sent."));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4" aria-label="Reply to your concierge">
      <Field data-invalid={tooLong || undefined}>
        <FieldLabel htmlFor={id}>Write to {request.ownerFirstName ?? "your concierge"}</FieldLabel>
        <Textarea
          id={id}
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            if (sent) setSent(false);
          }}
          rows={4}
          disabled={pending}
          aria-invalid={tooLong || undefined}
          className="min-h-28 rounded-none text-base md:text-sm"
          placeholder="A question, a detail, a change of mind…"
        />
        <FieldDescription>
          {request.ownerFirstName
            ? `${request.ownerFirstName} reads this on your request.`
            : "A concierge reads this when they take up your request."}{" "}
          Sending marks the request “{CASE_STATUS_LABELS.awaiting_staff}”. A change to the design is never made from a
          message alone.
        </FieldDescription>
        {tooLong ? (
          <FieldError>
            Keep your message under {formatNumber(MESSAGE_MAX_CHARS)} characters; it is {formatNumber(trimmed.length)}{" "}
            now.
          </FieldError>
        ) : null}
      </Field>

      {error ? (
        error.code === "UNAUTHENTICATED" ? (
          <ErrorAlert
            title="Your message was not sent"
            message={
              <>
                This request belongs to an account.{" "}
                <Link
                  href={`${routes.signIn}?redirect_url=${encodeURIComponent(pathname)}`}
                  className="underline underline-offset-4"
                >
                  Sign in
                </Link>{" "}
                and your words are still here.
              </>
            }
          />
        ) : (
          <ErrorAlert title="Your message was not sent" message={`${error.message} Your words are still here.`} />
        )
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="submit"
          className="h-11 rounded-none px-5"
          disabled={!trimmed || tooLong || pending}
          aria-busy={pending}
        >
          {pending ? <Spinner data-icon="inline-start" aria-label="Sending your message" /> : null}
          {pending ? "Sending…" : error ? "Try again" : "Send"}
        </Button>
        {pending || sent ? (
          <StatusLine live tone={pending ? "neutral" : "success"}>
            {pending ? "Sending…" : `Sent · ${CASE_STATUS_LABELS.awaiting_staff.toLowerCase()}`}
          </StatusLine>
        ) : null}
      </div>
    </form>
  );
}
