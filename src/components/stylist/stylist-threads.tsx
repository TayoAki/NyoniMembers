"use client";

import { useMutation } from "convex/react";
import { MessageSquare, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { EXAMPLE_BRIEFS } from "@/components/stylist/example-briefs";
import { ThreadList, ThreadListSkeleton } from "@/components/stylist/thread-list";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { DEFAULT_THREAD_TITLE, useStylistThreads } from "@/hooks/use-stylist";
import { reportError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";

export function StylistThreads() {
  const router = useRouter();
  const { threads } = useStylistThreads();
  const create = useMutation(api.threads.create);
  const remove = useMutation(api.threads.remove);
  const [starting, setStarting] = useState(false);

  /** A brief passed here is handed to the new thread through the URL so the chat sends it on mount. */
  async function startChat(brief?: string) {
    setStarting(true);
    try {
      const threadId = await create({ title: DEFAULT_THREAD_TITLE });
      router.push(brief ? `${routes.thread(threadId)}?brief=${encodeURIComponent(brief)}` : routes.thread(threadId));
    } catch (error) {
      reportError(error, "Could not start a new chat.");
      setStarting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader
        title="Stylist"
        description="Tell me the occasion and I'll build outfits from the clothes you own."
        actions={
          <Button onClick={() => void startChat()} disabled={starting}>
            {starting ? <Spinner data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
            New chat
          </Button>
        }
      />

      {threads === undefined ? (
        <ThreadListSkeleton />
      ) : threads.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Your stylist is waiting"
          description="Describe where you're going and I'll put two or three outfits together from your wardrobe, explain why they work, and show you what a render costs before anything is spent."
          action={
            <div className="flex w-full flex-col items-center gap-2">
              {EXAMPLE_BRIEFS.map((brief) => (
                <Button
                  key={brief}
                  variant="outline"
                  size="sm"
                  disabled={starting}
                  className="h-auto max-w-full py-1.5 text-left whitespace-normal"
                  onClick={() => void startChat(brief)}
                >
                  {brief}
                </Button>
              ))}
            </div>
          }
        />
      ) : (
        <ThreadList threads={threads} onDelete={(threadId) => remove({ threadId })} />
      )}
    </div>
  );
}
