"use client";

import { MessageSquare, Trash } from "lucide-react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { StylistThread } from "@/hooks/use-stylist";
import { formatRelative } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { Id } from "@convex/_generated/dataModel";

type ThreadListProps = {
  threads: StylistThread[];
  onDelete: (threadId: Id<"threads">) => Promise<unknown>;
};

export function ThreadList({ threads, onDelete }: ThreadListProps) {
  return (
    <ul className="space-y-2">
      {threads.map((thread) => (
        <li key={thread._id}>
          <div className="group bg-card ring-foreground/5 hover:bg-muted/40 flex items-center gap-3 rounded-xl border p-3 ring-1 transition-colors">
            <span
              className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg"
              aria-hidden
            >
              <MessageSquare className="size-4" />
            </span>
            <Link href={routes.thread(thread._id)} className="min-w-0 flex-1 outline-none focus-visible:underline">
              <span className="block truncate text-sm font-medium">{thread.title}</span>
              <span className="text-muted-foreground block text-xs">{formatRelative(thread.lastMessageAt)}</span>
            </Link>
            <ConfirmDialog
              trigger={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${thread.title}`}
                  className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Trash />
                </Button>
              }
              title="Delete this chat?"
              description="The conversation goes; outfits you saved from it stay in your wardrobe."
              confirmLabel="Delete"
              destructive
              onConfirm={() => onDelete(thread._id)}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ThreadListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading chats">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-xl border p-3">
          <Skeleton className="size-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
