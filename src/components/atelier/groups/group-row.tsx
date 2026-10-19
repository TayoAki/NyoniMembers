"use client";

import Link from "next/link";
import { GROUP_TONES } from "@/components/atelier/groups/group-words";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { Button } from "@/components/ui/button";
import { formatDate, formatRelative } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { GroupSummary } from "@convex/atelier/groups";

/** One group in the organizer's list: its name and occasion, the truthful status, and who has joined. */
export function GroupRow({ group }: { group: GroupSummary }) {
  return (
    <li className="grid gap-4 py-5 lg:grid-cols-[1fr_auto] lg:items-start lg:gap-8">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-display text-xl font-medium">{group.name}</h2>
          <span className="text-sm text-muted-foreground">
            {group.occasionLabel}
            {group.eventDate ? ` · ${formatDate(group.eventDate)}` : ""}
          </span>
        </div>
        <StatusLine tone={GROUP_TONES[group.status]}>{group.statusLabel}</StatusLine>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            {group.joinedCount} of {group.participantCount} joined
          </span>
          <span>Updated {formatRelative(group.updatedAt)}</span>
          <Mono upper={false}>{group._id}</Mono>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <Button
          variant="outline"
          className="h-11 rounded-none px-5"
          render={<Link href={routes.atelier.group(group._id)} />}
          nativeButton={false}
        >
          Open
        </Button>
      </div>
    </li>
  );
}
