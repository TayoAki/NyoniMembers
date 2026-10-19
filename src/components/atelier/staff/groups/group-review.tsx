"use client";

import { useQuery } from "convex/react";
import { Users } from "lucide-react";
import Link from "next/link";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { Mono } from "@/components/atelier/common/mono";
import { OrderBook, OrderBookRow } from "@/components/atelier/common/order-book";
import { StatusLine } from "@/components/atelier/common/status-line";
import { SpecOrderBook } from "@/components/atelier/staff/case/case-design";
import { StaffRoleGate, StaffShell } from "@/components/atelier/staff/staff-shell";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDateTime, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { GroupReviewView } from "@convex/atelier/groups";
import { GroupReviewForm } from "./group-review-form";
import { GroupsSkeleton } from "./groups-skeleton";
import { GROUP_STATUS_TONES, GROUPS_DESCRIPTION, GROUPS_TITLE, PARTICIPANT_STATUS_TONES } from "./groups-words";

/** Group commissions awaiting the house's review (C28). Needs the concierge role; admins pass. */
export function GroupReviewDesk() {
  return (
    <StaffShell title={GROUPS_TITLE} description={GROUPS_DESCRIPTION}>
      <StaffRoleGate role="concierge" fallback={<GroupsSkeleton />}>
        <GroupReviewBody />
      </StaffRoleGate>
    </StaffShell>
  );
}

function GroupReviewBody() {
  const groups = useQuery(api.atelier.groups.listForReview, {});
  if (groups === undefined) return <GroupsSkeleton />;
  if (groups.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No group is with the house"
        description="A group appears here once its organizer sends it for review, and stays while it is approved. Drafts and closed groups are not listed."
        action={
          <Button variant="outline" nativeButton={false} render={<Link href={routes.staffAtelier.queue} />}>
            Back to the queue
          </Button>
        }
      />
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm leading-relaxed text-muted-foreground">
        {pluralize(groups.length, "group")}. The organizer never sees a participant&rsquo;s measurements, photographs or
        design; neither does this page.
      </p>
      {groups.map((group) => (
        <GroupReviewSection key={group._id} group={group} />
      ))}
    </div>
  );
}

/** One group, in full: facts, participants, the shared design and the review form. Pure apart from the form. */
export function GroupReviewSection({ group }: { group: GroupReviewView }) {
  return (
    <AtelierSection
      id={`group-${group._id}`}
      title={
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {group.name}
          <StatusLine tone={GROUP_STATUS_TONES[group.status]}>{group.statusLabel}</StatusLine>
        </span>
      }
      description={`Organized by ${group.organizerName} · ${group.occasionLabel}${group.eventDate !== undefined ? ` · ${formatDate(group.eventDate)}` : " · no event date"} · sent ${formatDateTime(group.updatedAt)}.`}
    >
      <div className="space-y-8">
        <OrderBook>
          <OrderBookRow
            label="Brief"
            value={<span className="whitespace-pre-wrap">{group.brief || "No brief written."}</span>}
            tone={group.brief ? "default" : "muted"}
          />
          <OrderBookRow
            label="Participants"
            value={`${pluralize(group.participantCount, "person", "people")} invited · ${group.joinedCount} joined · ${group.designReadyCount} design ready · ${group.fitReadyCount} fit ready`}
            note="Readiness is shown only where the participant consented to share it."
          />
          <OrderBookRow
            label="House's note"
            value={
              group.staffReviewNote ? <span className="whitespace-pre-wrap">{group.staffReviewNote}</span> : "None yet"
            }
            tone={group.staffReviewNote ? "default" : "muted"}
            note="The organizer reads this on their group page."
          />
          <OrderBookRow
            label="Individual choices"
            value="Not carried by the review view"
            tone="muted"
            note="Which details each participant may set for themselves is recorded on the group but not returned to this desk yet."
          />
          <OrderBookRow
            label="Receipt"
            value={<Mono upper={false}>{group._id}</Mono>}
            note={`Created ${formatDateTime(group.createdAt)}.`}
          />
        </OrderBook>

        <div className="space-y-3">
          <h3 className="text-base font-medium">Who has joined</h3>
          {group.participants.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody has been invited yet.</p>
          ) : (
            <div className="-mx-4 sm:mx-0">
              <Table className="min-w-[40rem]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Shares</TableHead>
                    <TableHead>Design</TableHead>
                    <TableHead>Fit</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.participants.map((participant) => (
                    <TableRow key={participant.participantId} className="align-top">
                      <TableCell className="font-medium">{participant.name}</TableCell>
                      <TableCell>
                        <StatusLine tone={PARTICIPANT_STATUS_TONES[participant.status]}>
                          {participant.statusLabel}
                        </StatusLine>
                      </TableCell>
                      <TableCell className="whitespace-normal text-muted-foreground">
                        {[
                          participant.consent.shareStyleStatus ? "style status" : null,
                          participant.consent.shareFitStatus ? "fit status" : null,
                        ]
                          .filter(Boolean)
                          .join(" and ") || "Nothing"}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {participant.designReady ? (
                          "Design ready"
                        ) : participant.consent.shareStyleStatus ? (
                          participant.hasDesign ? (
                            "Started"
                          ) : (
                            "Not started"
                          )
                        ) : (
                          <span className="text-muted-foreground">Not shared</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        {participant.fitReady ? (
                          "Fit ready"
                        ) : participant.consent.shareFitStatus ? (
                          "Not yet"
                        ) : (
                          <span className="text-muted-foreground">Not shared</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Mono upper={false} className="text-[11px] text-foreground/80">
                          {participant.joinedAt !== undefined
                            ? formatDate(participant.joinedAt)
                            : `invited ${formatDate(participant.invitedAt)}`}
                        </Mono>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-base font-medium">Shared design</h3>
          <p className="text-sm text-muted-foreground">
            The order book every participant starts from, with the production ids the cutter reads.
          </p>
          <SpecOrderBook lines={group.sharedLines} />
        </div>

        <div className="space-y-3">
          <h3 className="text-base font-medium">The house&rsquo;s review</h3>
          <GroupReviewForm group={group} />
        </div>
      </div>
    </AtelierSection>
  );
}
