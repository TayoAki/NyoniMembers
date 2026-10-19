"use client";

import { useQuery } from "convex/react";
import { Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { signInHref } from "@/components/atelier/fit/fit-words";
import { GroupBoundary } from "@/components/atelier/groups/group-boundary";
import { GroupCreateForm } from "@/components/atelier/groups/group-create-form";
import { GroupRow } from "@/components/atelier/groups/group-row";
import { GROUP_REVIEW_SENTENCE, ORGANIZER_ISOLATION } from "@/components/atelier/groups/group-words";
import { GroupsSkeleton } from "@/components/atelier/groups/groups-skeleton";
import { StatusLine } from "@/components/atelier/common/status-line";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { useAtelierViewer } from "@/hooks/atelier/use-atelier-viewer";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";

const TITLE = "Group commissions.";
const DESCRIPTION =
  "A wedding party or another group: one brief and one shared design, each participant designing and fitted privately, the house reviewing the whole before anything is cut.";

/**
 * S35 list (C28): the groups this account organizes. Organizing needs an account, because invitations go
 * out in someone's name; joining one does not, so guests are told where their invitation leads.
 */
export function GroupsPage() {
  const viewer = useAtelierViewer();
  if (viewer.status === "loading") return <GroupsSkeleton />;
  if (viewer.status === "signed_out") return <SignedOut />;
  return (
    <GroupBoundary notFound={<Unavailable />} signedOut={<SignedOut />}>
      <GroupsList enabled={viewer.convexReady} />
    </GroupBoundary>
  );
}

function SignedOut() {
  return (
    <div className="space-y-8 pt-6">
      <PageHeader title={TITLE} description={DESCRIPTION} />
      <section aria-labelledby="groups-signed-out" className="space-y-4 border-y border-foreground/15 py-6">
        <h2 id="groups-signed-out" className="text-xl font-medium tracking-tight">
          Sign in to organize a group
        </h2>
        <div className="max-w-2xl space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            An organizer writes the brief — the occasion, the date, the shared design and which details each person may
            choose for themselves — and invites each participant by name. Invitations go out in the organizer&rsquo;s
            name, so a group is organized from an account.
          </p>
          <p>{ORGANIZER_ISOLATION}</p>
          <p>
            If you were invited, open the link the organizer sent you. No account is needed to join, and your design
            starts in this browser.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            className="h-11 rounded-none px-5"
            render={<Link href={signInHref(routes.atelier.groups)} />}
            nativeButton={false}
          >
            Sign in
          </Button>
          <Link
            href={routes.atelier.home}
            className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4 hover:text-muted-foreground"
          >
            Design on your own
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          You can design without signing in; your work waits in this browser.
        </p>
      </section>
    </div>
  );
}

function Unavailable() {
  return (
    <div className="space-y-8 pt-6">
      <PageHeader title={TITLE} description={DESCRIPTION} />
      <section aria-labelledby="groups-unavailable" className="space-y-3 border-y border-foreground/15 py-6">
        <h2 id="groups-unavailable" className="text-xl font-medium tracking-tight">
          Your groups are not available right now
        </h2>
        <StatusLine tone="warning">Could not read your groups</StatusLine>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Nothing is assumed in the meantime. Reload to try again; if it persists, your concierge can tell you where
          each group stands.
        </p>
      </section>
    </div>
  );
}

function GroupsList({ enabled }: { enabled: boolean }) {
  const groups = useQuery(api.atelier.groups.listMine, enabled ? {} : "skip");
  const [creating, setCreating] = useState(false);
  if (groups === undefined) return <GroupsSkeleton />;

  const empty = groups.length === 0;
  const createButton = (
    <Button className="h-11 rounded-none px-5" onClick={() => setCreating(true)} disabled={creating}>
      Create a group
    </Button>
  );

  return (
    <div className="space-y-8 pt-6">
      <PageHeader title={TITLE} description={DESCRIPTION} actions={empty || creating ? undefined : createButton} />

      {creating ? <GroupCreateForm onCancel={() => setCreating(false)} /> : null}

      {empty && !creating ? (
        <EmptyState
          icon={Users}
          title="No groups yet"
          description={`${GROUP_REVIEW_SENTENCE} Start with the brief and the shared design; invitations follow.`}
          action={createButton}
          className="rounded-none"
        />
      ) : !empty ? (
        <ul className="divide-y divide-foreground/10 border-y border-foreground/15" aria-label="Your groups">
          {groups.map((group) => (
            <GroupRow key={group._id} group={group} />
          ))}
        </ul>
      ) : null}

      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{ORGANIZER_ISOLATION}</p>
    </div>
  );
}
