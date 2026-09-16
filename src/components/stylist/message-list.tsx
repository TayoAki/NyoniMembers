"use client";

import type { EveMessage, EveMessagePart } from "eve/react";
import { Sparkles } from "lucide-react";
import { ApprovalCard } from "@/components/stylist/approval-card";
import { MarkdownLite } from "@/components/stylist/markdown-lite";
import { ProposalCards } from "@/components/stylist/proposal-cards";
import { QuestionCard } from "@/components/stylist/question-card";
import { RenderJobCard } from "@/components/stylist/render-job-card";
import { ToolActivity } from "@/components/stylist/tool-activity";
import type { PendingRequest } from "@/hooks/use-stylist";
import { cn } from "@/lib/utils";
import type { Id } from "@convex/_generated/dataModel";

type DynamicToolPart = Extract<EveMessagePart, { type: "dynamic-tool" }>;

type MessageListProps = {
  messages: readonly EveMessage[];
  threadId: Id<"threads">;
  onRespond: (response: { requestId: string; optionId?: string; text?: string }) => Promise<void>;
  onSaveOutfit: (name: string) => void;
  isBusy: boolean;
};

export function MessageList({ messages, threadId, onRespond, onSaveOutfit, isBusy }: MessageListProps) {
  return (
    <div className="space-y-5">
      {messages.map((message) =>
        message.role === "user" ? (
          <UserMessage key={message.id} message={message} />
        ) : (
          <AssistantMessage
            key={message.id}
            message={message}
            threadId={threadId}
            onRespond={onRespond}
            onSaveOutfit={onSaveOutfit}
            isBusy={isBusy}
          />
        ),
      )}
    </div>
  );
}

function UserMessage({ message }: { message: EveMessage }) {
  const text = message.parts
    .filter((part): part is Extract<EveMessagePart, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
  if (text.length === 0) return null;

  return (
    <div className="flex justify-end">
      <div
        className={cn(
          "bg-primary text-primary-foreground max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 text-sm sm:max-w-[75%]",
          message.metadata?.status === "failed" && "bg-destructive/15 text-destructive",
        )}
      >
        <MarkdownLite text={text} className="space-y-1.5" />
      </div>
    </div>
  );
}

function AssistantMessage({
  message,
  threadId,
  onRespond,
  onSaveOutfit,
  isBusy,
}: {
  message: EveMessage;
  threadId: Id<"threads">;
  onRespond: MessageListProps["onRespond"];
  onSaveOutfit: (name: string) => void;
  isBusy: boolean;
}) {
  const parts = message.parts.filter(isRenderable);
  if (parts.length === 0) return null;

  return (
    <div className="flex gap-2.5">
      <span
        className="bg-muted text-muted-foreground mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full"
        aria-hidden
      >
        <Sparkles className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        {parts.map((part, index) => (
          <PartView
            key={`${message.id}-${index}`}
            part={part}
            threadId={threadId}
            onRespond={onRespond}
            onSaveOutfit={onSaveOutfit}
            isBusy={isBusy}
          />
        ))}
      </div>
    </div>
  );
}

/** Reasoning and step markers stay out of the transcript; empty text blocks would draw an empty row. */
function isRenderable(part: EveMessagePart): boolean {
  if (part.type === "text") return part.text.trim().length > 0;
  return part.type === "dynamic-tool" || part.type === "authorization";
}

function PartView({
  part,
  threadId,
  onRespond,
  onSaveOutfit,
  isBusy,
}: {
  part: EveMessagePart;
  threadId: Id<"threads">;
  onRespond: MessageListProps["onRespond"];
  onSaveOutfit: (name: string) => void;
  isBusy: boolean;
}) {
  if (part.type === "text") {
    return part.text.trim().length > 0 ? <MarkdownLite text={part.text} /> : null;
  }

  if (part.type === "authorization") {
    return (
      <p className="bg-muted/40 rounded-lg border p-3 text-sm">
        {part.state === "completed"
          ? `${part.displayName} authorization ${part.outcome}.`
          : (part.description ?? `${part.displayName} needs to be connected.`)}
        {part.state === "required" && part.authorization?.url ? (
          <a
            className="ml-1 underline underline-offset-2"
            href={part.authorization.url}
            rel="noreferrer"
            target="_blank"
          >
            Sign in
          </a>
        ) : null}
      </p>
    );
  }

  if (part.type !== "dynamic-tool") return null;
  return <ToolPart part={part} threadId={threadId} onRespond={onRespond} onSaveOutfit={onSaveOutfit} isBusy={isBusy} />;
}

function ToolPart({
  part,
  threadId,
  onRespond,
  onSaveOutfit,
  isBusy,
}: {
  part: DynamicToolPart;
  threadId: Id<"threads">;
  onRespond: MessageListProps["onRespond"];
  onSaveOutfit: (name: string) => void;
  isBusy: boolean;
}) {
  if (part.state === "approval-requested") {
    const request = part.toolMetadata?.eve?.inputRequest;
    if (!request) return null;
    const pending: PendingRequest = {
      requestId: request.requestId,
      toolCallId: part.toolCallId,
      toolName: part.toolName,
      input: part.input,
      request,
    };
    return request.kind === "question" ? (
      <QuestionCard pending={pending} onRespond={onRespond} disabled={isBusy} />
    ) : (
      <ApprovalCard pending={pending} onRespond={onRespond} disabled={isBusy} />
    );
  }

  if (part.state === "approval-responded") {
    return <ToolActivity toolName={part.toolName} input={part.input} state="running" detail="Answer sent…" />;
  }

  if (part.state === "output-denied") {
    return (
      <ToolActivity
        toolName={part.toolName}
        input={part.input}
        state="error"
        detail={part.approval.reason ?? "Cancelled."}
      />
    );
  }

  if (part.state === "output-error") {
    return <ToolActivity toolName={part.toolName} input={part.input} state="error" detail={part.errorText} />;
  }

  if (part.state === "input-streaming" || part.state === "input-available") {
    return <ToolActivity toolName={part.toolName} input={part.input} state="running" />;
  }

  // output-available
  if (part.toolName === "compose_outfits") {
    const { outfitIds, problems } = readComposeOutput(part.output);
    return (
      <ProposalCards
        threadId={threadId}
        outfitIds={outfitIds}
        problems={problems}
        onSave={onSaveOutfit}
        canSave={!isBusy}
      />
    );
  }

  if (part.toolName === "start_renders") {
    const jobId = readJobId(part.output);
    return jobId ? <RenderJobCard jobId={jobId} /> : null;
  }

  return <ToolActivity toolName={part.toolName} input={part.input} state="done" />;
}

type ComposeResult = { outfitId: string | null; name: string; problems: string[] };

function readComposeOutput(output: unknown): {
  outfitIds: Id<"outfits">[];
  problems: { name: string; problems: string[] }[];
} {
  const results = (output as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return { outfitIds: [], problems: [] };

  const outfitIds: Id<"outfits">[] = [];
  const problems: { name: string; problems: string[] }[] = [];
  for (const entry of results as ComposeResult[]) {
    if (typeof entry?.outfitId === "string") outfitIds.push(entry.outfitId as Id<"outfits">);
    else if (Array.isArray(entry?.problems) && entry.problems.length > 0) {
      problems.push({ name: entry.name ?? "That outfit", problems: entry.problems });
    }
  }
  return { outfitIds, problems };
}

function readJobId(output: unknown): Id<"jobs"> | null {
  const jobId = (output as { jobId?: unknown } | null)?.jobId;
  return typeof jobId === "string" ? (jobId as Id<"jobs">) : null;
}
