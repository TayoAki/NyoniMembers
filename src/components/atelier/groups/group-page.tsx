"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment, useState } from "react";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { Mono } from "@/components/atelier/common/mono";
import { OrderBook, OrderBookRow, OrderBookSection } from "@/components/atelier/common/order-book";
import { StatusLine } from "@/components/atelier/common/status-line";
import { signInHref } from "@/components/atelier/fit/fit-words";
import { GroupBoundary } from "@/components/atelier/groups/group-boundary";
import { GroupNotFound } from "@/components/atelier/groups/group-not-found";
import {
  GROUP_STATUS_SENTENCES,
  GROUP_TONES,
  ORGANIZER_ISOLATION,
  permittedLabel,
} from "@/components/atelier/groups/group-words";
import { GroupSkeleton } from "@/components/atelier/groups/groups-skeleton";
import { InviteForm } from "@/components/atelier/groups/invite-form";
import { ParticipantRow } from "@/components/atelier/groups/participant-row";
import { groupLines, lineKey } from "@/components/atelier/requests/case-words";
import { ShadeChip } from "@/components/atelier/studio/cloth/shade-chip";
import { ItemImage } from "@/components/common/item-image";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { useAtelierViewer } from "@/hooks/atelier/use-atelier-viewer";
import { formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { GroupView } from "@convex/atelier/groups";
import type { ClothSummary } from "@convex/atelier/views";
import { ATELIER_LIMITS } from "@convex/shared/atelier/enums";
import { eventReadiness } from "@convex/shared/atelier/policy";

/**
 * S35 · the organizer's group (C28): the brief, the shared design, each participant's consented readiness
 * and the invitations. The page says what the organizer cannot see, because that boundary is the product.
 */
export function GroupPage({ groupId }: { groupId: string }) {
  const viewer = useAtelierViewer();
  if (viewer.status === "loading") return <GroupSkeleton />;
  if (viewer.status === "signed_out") return <SignedOut groupId={groupId} />;
  return (
    <GroupBoundary notFound={<GroupNotFound />} signedOut={<SignedOut groupId={groupId} />}>
      <GroupLoader groupId={groupId} enabled={viewer.convexReady} />
    </GroupBoundary>
  );
}

function SignedOut({ groupId }: { groupId: string }) {
  return (
    <div className="space-y-8 pt-6">
      <PageHeader
        title="Your group."
        description="A group is organized from an account, so only its organizer sees the brief, the invitations and each participant's consented readiness."
      />
      <section aria-labelledby="group-signed-out" className="space-y-4 border-y border-foreground/15 py-6">
        <h2 id="group-signed-out" className="text-xl font-medium tracking-tight">
          Sign in to see this group
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          If you were invited to a group rather than organizing one, open the invitation link the organizer sent you; no
          account is needed to join.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            className="h-11 rounded-none px-5"
            render={<Link href={signInHref(routes.atelier.group(groupId))} />}
            nativeButton={false}
          >
            Sign in
          </Button>
          <Link
            href={routes.atelier.groups}
            className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4 hover:text-muted-foreground"
          >
            Groups
          </Link>
        </div>
      </section>
    </div>
  );
}

function GroupLoader({ groupId, enabled }: { groupId: string; enabled: boolean }) {
  // The route gives a string; the server validates it as an id of its table (a refusal renders not-found).
  const group = useQuery(api.atelier.groups.get, enabled ? { groupId: groupId as Id<"atelierGroups"> } : "skip");
  if (group === undefined) return <GroupSkeleton />;
  if (group === null) notFound();
  return <GroupDetail group={group} />;
}

function GroupDetail({ group }: { group: GroupView }) {
  const [now] = useState(() => Date.now());
  const readiness = group.eventDate !== undefined ? eventReadiness(group.eventDate, now) : null;
  const live = group.participants.filter((participant) => participant.status !== "declined");
  const joined = live.filter((participant) => participant.status !== "invited").length;
  const sections = groupLines(group.sharedLines);

  return (
    <div className="space-y-8 pt-6">
      <PageHeader
        title={group.name}
        description={
          <>
            {group.occasionLabel}
            {group.eventDate !== undefined ? ` · ${formatDate(group.eventDate)}` : ""} · created{" "}
            {formatDate(group.createdAt)}
          </>
        }
        actions={
          <Button
            variant="outline"
            className="h-11 rounded-none px-5"
            render={<Link href={routes.atelier.groups} />}
            nativeButton={false}
          >
            All groups
          </Button>
        }
      />

      <section aria-label="Status" className="space-y-3 border-y border-foreground/15 py-5">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="text-muted-foreground">Group</span>
          <Mono upper={false} className="text-foreground">
            {group._id}
          </Mono>
        </p>
        <StatusLine tone={GROUP_TONES[group.status]} live className="text-sm">
          {group.statusLabel}
        </StatusLine>
        <div className="max-w-2xl space-y-1.5 text-sm leading-relaxed text-muted-foreground">
          <p>{GROUP_STATUS_SENTENCES[group.status]}</p>
          {readiness && readiness.state !== "none" ? (
            <p className={cn(readiness.state !== "comfortable" && "text-warning")}>{readiness.copy}</p>
          ) : null}
          <p>{ORGANIZER_ISOLATION}</p>
        </div>
      </section>

      <div>
        <AtelierSection id="brief" title="The brief" description="Read by every participant and by the house.">
          {group.brief.trim() ? (
            <p className="max-w-2xl text-sm leading-relaxed whitespace-pre-line">{group.brief}</p>
          ) : (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">No brief was written.</p>
          )}
        </AtelierSection>

        <AtelierSection
          id="shared-design"
          title="The shared design"
          description={
            group.cloth
              ? `Every participant starts from these lines, cut in ${group.cloth.name}${group.cloth.mill ? ` by ${group.cloth.mill}` : ""}.`
              : "Every participant starts from these lines; the cloth is left to each person."
          }
        >
          <div className={cn("grid gap-6", group.cloth?.imageUrl && "md:grid-cols-[minmax(0,10rem)_1fr]")}>
            {group.cloth?.imageUrl ? (
              <ItemImage
                src={group.cloth.imageUrl}
                alt={`${group.cloth.name}, from the mill book`}
                variant="photo"
                aspect="aspect-[3/4]"
                className="w-full max-w-40 rounded-none"
              />
            ) : null}
            <div className="min-w-0 space-y-6">
              <OrderBook aria-label="The shared design">
                {sections.map((section) => (
                  <Fragment key={section.section}>
                    <OrderBookSection>{section.section}</OrderBookSection>
                    {section.lines.map((line) => (
                      <OrderBookRow
                        key={lineKey(line)}
                        label={line.label}
                        value={line.value}
                        code={line.productionId}
                        note={line.section === "Cloth" && group.cloth ? <ClothNote cloth={group.cloth} /> : undefined}
                        tone={
                          line.section === "Cloth" && group.cloth && clothWarning(group.cloth) ? "warning" : "default"
                        }
                      />
                    ))}
                  </Fragment>
                ))}
              </OrderBook>
              <div className="space-y-2">
                <h3 className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                  Each participant chooses
                </h3>
                {group.permittedIndividual.length > 0 ? (
                  <p className="text-sm leading-relaxed">{group.permittedIndividual.map(permittedLabel).join(" · ")}</p>
                ) : (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Nothing is left open: every detail follows the shared design.
                  </p>
                )}
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Fit and measurements are always each person&rsquo;s own, and are never shown here.
                </p>
              </div>
            </div>
          </div>
        </AtelierSection>

        <AtelierSection
          id="participants"
          title="Participants"
          description={`${joined} of ${live.length} joined · a group holds up to ${ATELIER_LIMITS.groupMaxParticipants}. Readiness appears only when a participant chooses to share it.`}
        >
          {group.participants.length === 0 ? (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              No one has been invited yet. The first invitation opens the group.
            </p>
          ) : (
            <ul className="divide-y divide-foreground/10 border-y border-foreground/15" aria-label="Participants">
              {group.participants.map((participant) => (
                <ParticipantRow key={participant.participantId} participant={participant} groupStatus={group.status} />
              ))}
            </ul>
          )}
          <div className="mt-6">
            <InviteForm group={group} />
          </div>
        </AtelierSection>
      </div>
    </div>
  );
}

function clothWarning(cloth: ClothSummary): string | null {
  if (cloth.status !== "approved") return "No longer offered — choose another cloth for the group with your concierge.";
  if (!cloth.inStock) return "Not in stock — ask your concierge.";
  return null;
}

function ClothNote({ cloth }: { cloth: ClothSummary }) {
  const warning = clothWarning(cloth);
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <ShadeChip hex={cloth.hex} confirmed={cloth.shadeConfirmed} />
      {warning ? <span className="text-warning">{warning}</span> : null}
    </span>
  );
}
