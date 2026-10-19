"use client";

import { useQuery } from "convex/react";
import { Inbox } from "lucide-react";
import Link from "next/link";
import { RequestRow } from "@/components/atelier/requests/request-row";
import { RequestsSkeleton } from "@/components/atelier/requests/requests-skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { useOwnerArgs } from "@/hooks/atelier/use-owner-args";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";

/**
 * S25 list (C19–C21): every request this browser or account has sent the house, most recent activity
 * first. A request is received, never booked or ordered; the receipt and the conversation live on each one.
 */
export function RequestsPage() {
  const requests = useQuery(api.atelier.cases.listMine, useOwnerArgs({}));
  if (requests === undefined) return <RequestsSkeleton />;

  const empty = requests.length === 0;
  const designButton = (
    <Button className="h-11 rounded-none px-5" render={<Link href={routes.atelier.home} />} nativeButton={false}>
      Design a suit
    </Button>
  );

  return (
    <div className="space-y-8 pt-6">
      <PageHeader
        title="Your requests."
        description="Everything you have asked the house for — a quote, a design review, a cloth sample, a fitting or a question — with its concierge and its latest word. A request is received, never booked."
        actions={empty ? undefined : designButton}
      />
      {empty ? (
        <EmptyState
          icon={Inbox}
          title="Your requests will appear here"
          description="When you ask the house for a quote, a design review, a sample or a fitting, the request and the conversation around it are kept here."
          action={designButton}
          className="rounded-none"
        />
      ) : (
        <ul className="divide-y divide-foreground/10 border-y border-foreground/15" aria-label="Your requests">
          {requests.map((request) => (
            <RequestRow key={request._id} request={request} />
          ))}
        </ul>
      )}
    </div>
  );
}
