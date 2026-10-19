"use client";

import { useMutation } from "convex/react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { StatusLine } from "@/components/atelier/common/status-line";
import { INVITE_LINK_SENTENCE, PARTICIPANT_NAME_MAX } from "@/components/atelier/groups/group-words";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toClientError, type ClientError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { GroupView } from "@convex/atelier/groups";
import { ATELIER_LIMITS } from "@convex/shared/atelier/enums";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Issued = { name: string; url: string };

/**
 * Invites one person by name and shows the link once (C28). The token is the invitation and the organizer
 * passes it on; an email only records a notification with the house, which is said beside the link.
 */
export function InviteForm({ group }: { group: GroupView }) {
  const id = useId();
  const invite = useMutation(api.atelier.groups.invite);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ClientError | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const live = group.participants.filter((participant) => participant.status !== "declined").length;
  const closedReason =
    group.status === "approved"
      ? "The house has approved this group. Ask your concierge to add someone."
      : group.status === "closed"
        ? "This group has been closed by the house."
        : live >= ATELIER_LIMITS.groupMaxParticipants
          ? `A group holds up to ${ATELIER_LIMITS.groupMaxParticipants} participants. Ask your concierge about a larger party.`
          : null;

  const nameError =
    name.trim().length === 0
      ? "Give the participant a name."
      : name.trim().length > PARTICIPANT_NAME_MAX
        ? `Keep the name to ${PARTICIPANT_NAME_MAX} characters.`
        : undefined;
  const emailError =
    email.trim() && !EMAIL_PATTERN.test(email.trim()) ? "That email address does not look right." : undefined;
  const valid = !nameError && !emailError;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAttempted(true);
    if (!valid) return;
    setPending(true);
    setError(null);
    const participantName = name.trim();
    try {
      const result = await invite({
        groupId: group._id,
        name: participantName,
        email: email.trim() ? email.trim() : undefined,
      });
      setIssued({
        name: participantName,
        url: `${window.location.origin}${routes.atelier.joinGroup(result.inviteToken)}`,
      });
      setName("");
      setEmail("");
      setAttempted(false);
      toast.success(`${participantName} invited.`, { description: "Copy the link below and pass it on." });
    } catch (failure) {
      const clientError = toClientError(failure);
      setError(clientError);
      toast.error(clientError.message);
    } finally {
      setPending(false);
    }
  };

  const copy = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.url);
      setCopied(true);
    } catch {
      toast.message("Copy the link from the field: this browser did not allow copying automatically.");
    }
  };

  return (
    <AtelierSection
      id="invite"
      level={3}
      title="Invite someone"
      description="By name. An email is optional and only records a notification with the house; the link below is the invitation."
    >
      {closedReason ? (
        <StatusLine tone="warning" className="text-sm">
          {closedReason}
        </StatusLine>
      ) : (
        <form
          onSubmit={(event) => void submit(event)}
          noValidate
          className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start"
        >
          <Field data-invalid={attempted && nameError ? true : undefined}>
            <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
            <Input
              id={`${id}-name`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="off"
              disabled={pending}
              aria-invalid={attempted && nameError ? true : undefined}
              className="h-11 rounded-none"
            />
            <FieldError>{attempted ? nameError : undefined}</FieldError>
          </Field>
          <Field data-invalid={attempted && emailError ? true : undefined}>
            <FieldLabel htmlFor={`${id}-email`}>
              Email <span className="font-normal text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Input
              id={`${id}-email`}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="off"
              disabled={pending}
              aria-invalid={attempted && emailError ? true : undefined}
              className="h-11 rounded-none"
            />
            <FieldError>{attempted ? emailError : undefined}</FieldError>
          </Field>
          <Button type="submit" className="h-11 rounded-none px-5 sm:mt-6" disabled={pending} aria-busy={pending}>
            {pending ? <Spinner data-icon="inline-start" aria-label="Inviting" /> : null}
            {pending ? "Inviting…" : "Invite"}
          </Button>
        </form>
      )}

      {error ? (
        <ErrorAlert
          className="mt-4"
          title="Could not invite"
          message={error.message}
          onRetry={() => setError(null)}
          retryLabel="Dismiss"
        />
      ) : null}

      {issued ? (
        <div className="mt-5 space-y-3 border-y border-foreground/15 py-4" role="status" aria-live="polite">
          <p className="text-sm">
            Invitation for <span className="font-medium">{issued.name}</span>
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              readOnly
              value={issued.url}
              aria-label={`Invitation link for ${issued.name}`}
              onFocus={(event) => event.currentTarget.select()}
              className="h-11 min-w-0 flex-1 rounded-none font-mono text-xs"
            />
            <Button type="button" variant="outline" className="h-11 rounded-none px-5" onClick={() => void copy()}>
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
          <FieldDescription>
            {INVITE_LINK_SENTENCE} The link is shown here once; if it is lost, invite {issued.name} again.
          </FieldDescription>
        </div>
      ) : null}
    </AtelierSection>
  );
}
