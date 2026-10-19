"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { Mono } from "@/components/atelier/common/mono";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { toClientError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";
import type { CaseMessageView, StaffCaseView } from "@convex/atelier/cases";
import { authorWords } from "./case-words";

/**
 * The conversation as the client sees it, plus the concierge's composer. System lines are the house's
 * own notes (status changes, sample steps, confirmations). A reply makes the request "Waiting on you"
 * for the client and records a notification; it does not send anything by itself.
 */
export function CaseConversation({ caseView }: { caseView: StaffCaseView }) {
  const clientFirstName = caseView.contact.name.trim().split(/\s+/)[0] || "Client";
  return (
    <AtelierSection
      id="conversation"
      title="Conversation"
      description="Everything the client reads under their request, oldest first. Nothing in chat changes a design: use a proposal for that."
    >
      <div className="space-y-6">
        {caseView.messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          <ol className="divide-y divide-foreground/10 border-y border-foreground/15">
            {caseView.messages.map((message) => (
              <MessageRow key={message._id} message={message} clientFirstName={clientFirstName} />
            ))}
          </ol>
        )}
        <Composer caseView={caseView} />
      </div>
    </AtelierSection>
  );
}

function MessageRow({ message, clientFirstName }: { message: CaseMessageView; clientFirstName: string }) {
  const system = message.author === "system";
  return (
    <li
      className={cn(
        "grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[minmax(7rem,11rem)_1fr]",
        system && "text-muted-foreground",
      )}
    >
      <div className="flex flex-col gap-0.5">
        <span
          className={cn(
            "text-xs font-medium tracking-wide",
            message.author === "staff" ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {authorWords(message.author, message.authorName, clientFirstName)}
        </span>
        <Mono upper={false} className="text-[11px]">
          {formatDateTime(message.createdAt)}
        </Mono>
      </div>
      <div className="min-w-0 space-y-1">
        <p className={cn("text-sm leading-relaxed whitespace-pre-wrap", system && "italic")}>{message.body}</p>
        {message.proposalId ? (
          <p className="text-xs text-muted-foreground">Carries a proposed change; see Proposed changes below.</p>
        ) : null}
      </div>
    </li>
  );
}

function Composer({ caseView }: { caseView: StaffCaseView }) {
  const reply = useMutation(api.atelier.cases.reply);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = `reply-${caseView._id}`;

  async function send() {
    const text = body.trim();
    if (!text) return;
    setPending(true);
    setError(null);
    try {
      await reply({ caseId: caseView._id, body: text });
      setBody("");
      toast.success("Reply added. The client reads it under their request; a notification record was queued.");
    } catch (caught) {
      setError(toClientError(caught).message);
    } finally {
      setPending(false);
    }
  }

  if (!caseView.open) {
    return (
      <p className="text-sm text-muted-foreground">
        This request is {caseView.statusLabel.toLowerCase()}; it takes no further replies.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <Field>
        <FieldLabel htmlFor={id}>Reply as the concierge</FieldLabel>
        <FieldDescription>
          Signed with your first name. The request becomes “Waiting on you” for the client, and a notification record is
          queued, not sent.
        </FieldDescription>
        <Textarea id={id} value={body} onChange={(event) => setBody(event.target.value)} rows={3} disabled={pending} />
      </Field>
      {error ? (
        <ErrorAlert
          title="The reply was not added"
          message={error}
          onRetry={() => void send()}
          retryLabel="Send again"
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          className="h-10 rounded-none px-5"
          disabled={pending || body.trim().length === 0}
          onClick={() => void send()}
        >
          {pending ? <Spinner data-icon="inline-start" /> : null}
          Reply
        </Button>
        {pending ? (
          <span className="text-xs text-muted-foreground" role="status">
            Sending…
          </span>
        ) : null}
      </div>
    </div>
  );
}
