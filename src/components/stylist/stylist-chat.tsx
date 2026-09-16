"use client";

import { useMutation } from "convex/react";
import { ArrowLeft, ShieldQuestionMark } from "lucide-react";
import { useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { ErrorAlert } from "@/components/common/error-alert";
import { PageHeader } from "@/components/common/page-header";
import { Composer } from "@/components/stylist/composer";
import { EXAMPLE_BRIEFS } from "@/components/stylist/example-briefs";
import { MessageList } from "@/components/stylist/message-list";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { DEFAULT_THREAD_TITLE, useStylistSession, type StylistThread } from "@/hooks/use-stylist";
import { reportError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";

type StylistChatProps = {
  thread: StylistThread;
  /** A brief carried over from the "New chat" buttons; sent once, then dropped from the URL. */
  initialBrief?: string;
};

/** Mount this keyed by thread id: the eve session is bound when the hook builds its store. */
export function StylistChat({ thread, initialBrief }: StylistChatProps) {
  const session = useStylistSession(thread);
  const rename = useMutation(api.threads.rename);
  const reduceMotion = useReducedMotion();
  const router = useRouter();

  const named = useRef(thread.title !== DEFAULT_THREAD_TITLE);
  const bottom = useRef<HTMLDivElement>(null);

  const messages = session.data.messages;
  const messageCount = messages.length;
  const tailLength = messages.at(-1)?.parts.length ?? 0;

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "end" });
  }, [messageCount, tailLength, reduceMotion]);

  const { send: sendTurn, respond: respondToRequest, cancel: cancelTurn, isBusy, isResuming, status } = session;

  const send = useCallback(
    async (message: string) => {
      if (!named.current) {
        named.current = true;
        void rename({ threadId: thread._id, title: titleFromBrief(message) }).catch(() => {
          named.current = false;
        });
      }
      try {
        await sendTurn(message, isBusy ? { turnPolicy: "steer" } : undefined);
      } catch (error) {
        reportError(error, "That message could not be sent.");
      }
    },
    [isBusy, rename, sendTurn, thread._id],
  );

  const respond = useCallback(
    async (response: { requestId: string; optionId?: string; text?: string }) => {
      await respondToRequest([response]);
    },
    [respondToRequest],
  );

  const cancel = useCallback(async () => {
    try {
      await cancelTurn();
    } catch (error) {
      reportError(error, "Could not stop that.");
    }
  }, [cancelTurn]);

  const saveOutfit = useCallback((name: string) => void send(`Save "${name}" to my outfits.`), [send]);

  const autoSent = useRef(false);
  useEffect(() => {
    if (autoSent.current || !initialBrief) return;
    if (isResuming || isBusy || messageCount > 0) return;
    autoSent.current = true;
    router.replace(routes.thread(thread._id));
    void send(initialBrief);
  }, [initialBrief, isBusy, isResuming, messageCount, router, send, thread._id]);

  const isEmpty = messageCount === 0 && !isResuming && !initialBrief;
  const showThinking =
    !isResuming &&
    (status === "submitted" || (isBusy && tailLength === 0) || (initialBrief !== undefined && messageCount === 0));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
      <PageHeader
        eyebrow="Stylist"
        title={thread.title}
        actions={
          <Button variant="outline" size="sm" render={<Link href={routes.stylist} />}>
            <ArrowLeft data-icon="inline-start" />
            All chats
          </Button>
        }
      />

      {isResuming && messageCount === 0 ? <ResumingShimmer /> : null}

      {isResuming && messageCount > 0 ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
          <Spinner className="size-3.5" />
          Catching up on this conversation…
        </p>
      ) : null}

      {isEmpty ? (
        <EmptyThread onPick={(brief) => void send(brief)} />
      ) : (
        <MessageList
          messages={messages}
          threadId={thread._id}
          onRespond={respond}
          onSaveOutfit={saveOutfit}
          isBusy={isBusy || isResuming}
        />
      )}

      {showThinking ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
          <Spinner className="size-3.5" />
          Thinking…
        </p>
      ) : null}

      {status === "error" && session.error ? (
        <ErrorAlert title="The stylist stopped" message={session.error.message} />
      ) : null}

      {session.pendingRequests.length > 0 ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
          <ShieldQuestionMark className="size-3.5 shrink-0" aria-hidden />
          Waiting on your answer above.
        </p>
      ) : null}

      <div ref={bottom} aria-hidden className="h-px" />

      <div className="mt-auto">
        <Composer onSend={send} onCancel={cancel} isBusy={isBusy} isResuming={isResuming} />
      </div>
    </div>
  );
}

function EmptyThread({ onPick }: { onPick: (brief: string) => void }) {
  return (
    <div className="space-y-4 rounded-xl border border-dashed p-5">
      <div className="space-y-1">
        <h2 className="text-base font-medium">Ask me what to wear</h2>
        <p className="text-muted-foreground text-sm text-pretty">
          Give me the occasion, the weather or the mood. I only use clothes that are already in your wardrobe, and
          I&apos;ll always tell you what a render costs before anything is spent.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_BRIEFS.map((brief) => (
          <Button
            key={brief}
            variant="outline"
            size="sm"
            className="h-auto max-w-full py-1.5 text-left whitespace-normal"
            onClick={() => onPick(brief)}
          >
            {brief}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ResumingShimmer() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Catching up on this conversation">
      <Skeleton className="ml-auto h-10 w-2/3 rounded-2xl" />
      <Skeleton className="h-16 w-4/5 rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

/** First line of the brief, trimmed to something that fits a sidebar row. */
function titleFromBrief(message: string): string {
  const line = message.trim().split("\n")[0].replace(/\s+/g, " ");
  return line.length <= 60 ? line : `${line.slice(0, 57).trimEnd()}…`;
}
