"use client";

import { useQuery } from "convex/react";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { Mono } from "@/components/atelier/common/mono";
import { authorWords } from "@/components/atelier/requests/case-words";
import { MessageComposer } from "@/components/atelier/requests/message-composer";
import { Skeleton } from "@/components/ui/skeleton";
import { useOwnerArgs } from "@/hooks/atelier/use-owner-args";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";
import type { CaseMessageView, CaseView } from "@convex/atelier/cases";

/** S26 (C20): the thread with the named concierge, oldest first, and the composer beneath it. */
export function Conversation({ request }: { request: CaseView }) {
  const messages = useQuery(api.atelier.cases.listMessages, useOwnerArgs({ caseId: request._id }));
  return (
    <AtelierSection
      id="conversation"
      title="Conversation"
      description="Your concierge, the house's notes and your replies, in order. A change to the design arrives as a proposal you accept or decline, never through chat alone."
    >
      {messages === undefined ? (
        <ThreadSkeleton />
      ) : messages.length === 0 ? (
        <p className="border-y border-foreground/15 py-4 text-sm text-muted-foreground">
          No messages yet. Your request is on record; the first word here will be the house&apos;s.
        </p>
      ) : (
        <ol className="divide-y divide-foreground/10 border-y border-foreground/15" aria-label="Messages">
          {messages.map((message) => (
            <MessageItem key={message._id} message={message} />
          ))}
        </ol>
      )}
      <MessageComposer request={request} />
    </AtelierSection>
  );
}

function MessageItem({ message }: { message: CaseMessageView }) {
  const system = message.author === "system";
  return (
    <li className="grid gap-1.5 py-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 sm:flex-col sm:items-start">
        <span className={cn("text-sm font-medium", system && "text-muted-foreground")}>{authorWords(message)}</span>
        <Mono upper={false} className="text-foreground/60">
          {formatDateTime(message.createdAt)}
        </Mono>
      </div>
      <div className="min-w-0 space-y-2">
        <p className={cn("text-sm leading-relaxed whitespace-pre-line", system && "text-muted-foreground")}>
          {message.body}
        </p>
        {message.proposalId ? (
          <a
            href={`#proposal-${message.proposalId}`}
            className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4 sm:min-h-0"
          >
            See the proposed change
          </a>
        ) : null}
      </div>
    </li>
  );
}

function ThreadSkeleton() {
  return (
    <div
      className="divide-y divide-foreground/10 border-y border-foreground/15"
      aria-busy="true"
      aria-label="Loading the conversation"
    >
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="grid gap-2 py-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-6">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-10 w-full max-w-xl" />
        </div>
      ))}
    </div>
  );
}
