"use client";

import { useQuery } from "convex/react";
import { MessageSquareOff } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { StylistChat } from "@/components/stylist/stylist-chat";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

/**
 * The chat is only mounted once the thread is loaded: `useEveAgent` reads `initialSession` and
 * `resume` when it builds its store, so the saved session cursor has to be in hand first.
 */
export function StylistChatRoute({ threadId, initialBrief }: { threadId: Id<"threads">; initialBrief?: string }) {
  const thread = useQuery(api.threads.get, { threadId });

  if (thread === undefined) return <ChatSkeleton />;
  if (thread === null) {
    return (
      <div className="mx-auto w-full max-w-3xl py-10">
        <EmptyState
          icon={MessageSquareOff}
          title="This chat is gone"
          description="It may have been deleted from another device."
          action={<Button render={<Link href={routes.stylist} />}>Back to the stylist</Button>}
        />
      </div>
    );
  }

  return <StylistChat key={thread._id} thread={thread} initialBrief={initialBrief} />;
}

export function ChatSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6" aria-busy="true" aria-label="Loading this chat">
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-8 w-56" />
      </div>
      <div className="space-y-5">
        <Skeleton className="ml-auto h-10 w-2/3 rounded-2xl" />
        <div className="flex gap-2.5">
          <Skeleton className="size-7 shrink-0 rounded-full" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-16 w-4/5 rounded-2xl" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-44 rounded-xl" />
              <Skeleton className="h-44 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
      <Skeleton className="h-16 w-full rounded-xl" />
    </div>
  );
}
