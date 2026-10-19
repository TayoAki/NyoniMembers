"use client";

import Link from "next/link";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { authorWords, CASE_TONES, statusWords } from "@/components/atelier/requests/case-words";
import { Button } from "@/components/ui/button";
import { formatDate, formatRelative } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { CaseSummary } from "@convex/atelier/cases";

/** One request in the list: its kind and design, the truthful status with the concierge's name, and the latest word. */
export function RequestRow({ request }: { request: CaseSummary }) {
  return (
    <li className="grid gap-4 py-5 lg:grid-cols-[1fr_auto] lg:items-start lg:gap-8">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-base font-medium">{request.kindLabel}</h2>
          {request.draftName ? (
            <span className="text-sm text-muted-foreground">
              about <span className="font-display text-foreground">{request.draftName}</span>
            </span>
          ) : null}
        </div>
        <StatusLine tone={CASE_TONES[request.status]}>{statusWords(request)}</StatusLine>
        {request.sampleStateLabel ? (
          <p className="text-sm text-muted-foreground">Sample: {request.sampleStateLabel}</p>
        ) : null}
        {request.latestMessage ? (
          <p className="line-clamp-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            <span className="text-foreground/80">{authorWords(request.latestMessage)}:</span>{" "}
            {request.latestMessage.body}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Last activity {formatRelative(request.lastActivityAt)}</span>
          <span>Sent {formatDate(request.createdAt)}</span>
          <Mono upper={false}>{request._id}</Mono>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <Button
          variant="outline"
          className="h-11 rounded-none px-5"
          render={<Link href={routes.atelier.request(request._id)} />}
          nativeButton={false}
        >
          Open
        </Button>
      </div>
    </li>
  );
}
