"use client";

import { useConvex, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { notFound, usePathname, useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { OrderBook, OrderBookRow, OrderBookSection } from "@/components/atelier/common/order-book";
import { StatusLine } from "@/components/atelier/common/status-line";
import { signInHref } from "@/components/atelier/fit/fit-words";
import { PARTICIPANT_ISOLATION, permittedLabel, PERMITTED_LABELS } from "@/components/atelier/groups/group-words";
import { JoinSkeleton } from "@/components/atelier/groups/groups-skeleton";
import { groupLines, lineKey } from "@/components/atelier/requests/case-words";
import { useAtelierSession } from "@/components/atelier/shell/atelier-session";
import { ShadeChip } from "@/components/atelier/studio/cloth/shade-chip";
import { ErrorAlert } from "@/components/common/error-alert";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useAtelierViewer } from "@/hooks/atelier/use-atelier-viewer";
import { useGuestKeyArg } from "@/hooks/atelier/use-owner-args";
import { toClientError, type ClientError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";
import type { InviteView } from "@convex/atelier/groups";
import { eventReadiness } from "@convex/shared/atelier/policy";

/**
 * S35 · an invitation (C28): what the group shares, what is the participant's to choose, what the organizer
 * will and will not see, and one action that creates a private design from the shared brief. A guest may
 * join; the design starts in this browser.
 */
export function JoinPage({ token }: { token: string }) {
  const invite = useQuery(api.atelier.groups.getInvite, { token });
  if (invite === undefined) return <JoinSkeleton />;
  if (invite === null) notFound();
  return <Invitation token={token} invite={invite} />;
}

function Invitation({ token, invite }: { token: string; invite: InviteView }) {
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();
  const convex = useConvex();
  const viewer = useAtelierViewer();
  const guestKeyArg = useGuestKeyArg();
  const { ready, storageAvailable, rememberDraft } = useAtelierSession();
  const join = useMutation(api.atelier.groups.join);
  const setConsent = useMutation(api.atelier.groups.setConsent);

  const [shareStyle, setShareStyle] = useState(false);
  const [shareFit, setShareFit] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ClientError | null>(null);
  const [now] = useState(() => Date.now());

  const readiness = invite.eventDate !== undefined ? eventReadiness(invite.eventDate, now) : null;
  const sections = groupLines(invite.sharedLines);
  const signedIn = viewer.status === "signed_in";
  const canJoin = ready && (signedIn || guestKeyArg.guestKey !== undefined);

  const handleJoin = async () => {
    setPending(true);
    setError(null);
    try {
      const { draftId } = await join({ ...guestKeyArg, token });
      rememberDraft({ draftId, name: `${invite.groupName} — ${invite.participantName}`, updatedAt: Date.now() });
      if (shareStyle || shareFit) {
        try {
          const participation = await convex.query(api.atelier.groups.myParticipation, { ...guestKeyArg, draftId });
          if (participation) {
            await setConsent({
              ...guestKeyArg,
              participantId: participation.participantId,
              consent: { shareStyleStatus: shareStyle, shareFitStatus: shareFit },
            });
          }
        } catch {
          toast.error(
            "You have joined, but your sharing choices could not be saved. Nothing is shared with the organizer until they are.",
          );
        }
      }
      toast.success("You have joined.", { description: "Your design starts from the shared brief." });
      router.push(routes.atelier.design(draftId));
    } catch (failure) {
      const clientError = toClientError(failure);
      setError(clientError);
      toast.error(clientError.message);
      setPending(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 pt-6">
      <PageHeader
        title={`${invite.organizerFirstName} has invited you to design with ${invite.groupName}.`}
        description={
          <>
            For <span className="text-foreground">{invite.participantName}</span> · {invite.occasionLabel}
            {invite.eventDate !== undefined ? ` · ${formatDate(invite.eventDate)}` : ""}. Each person in the group
            designs and is fitted privately with Nyoni Couture; the shared design below is where yours starts.
          </>
        }
      />

      {readiness && readiness.state !== "none" ? (
        <p
          className={cn(
            "max-w-2xl border-y border-foreground/15 py-3 text-sm leading-relaxed",
            readiness.state === "comfortable" ? "text-muted-foreground" : "text-warning",
          )}
        >
          {readiness.copy}
        </p>
      ) : null}

      <div>
        <AtelierSection
          id="shared-design"
          title="The shared design"
          description={
            invite.cloth
              ? `Cut in ${invite.cloth.name}${invite.cloth.mill ? ` by ${invite.cloth.mill}` : ""}, like everyone in the group.`
              : "The cloth is yours to choose from the house's range; the cut is shared."
          }
        >
          <OrderBook aria-label="The shared design">
            {sections.map((section) => (
              <div key={section.section}>
                <OrderBookSection>{section.section}</OrderBookSection>
                {section.lines.map((line) => (
                  <OrderBookRow
                    key={lineKey(line)}
                    label={line.label}
                    value={line.value}
                    code={line.productionId}
                    note={
                      line.section === "Cloth" && invite.cloth ? (
                        <ShadeChip hex={invite.cloth.hex} confirmed={invite.cloth.shadeConfirmed} />
                      ) : undefined
                    }
                  />
                ))}
              </div>
            ))}
          </OrderBook>
        </AtelierSection>

        <AtelierSection
          id="yours"
          title="Yours to choose"
          description="These details are left to each participant. Everything else follows the shared design; your fit and your measurements are always your own."
        >
          {invite.permittedIndividual.length > 0 ? (
            <ul className="divide-y divide-foreground/10 border-y border-foreground/15">
              {invite.permittedIndividual.map((path) => (
                <li key={path} className="grid gap-x-6 gap-y-0.5 py-3 sm:grid-cols-[minmax(7rem,11rem)_1fr]">
                  <span className="text-sm font-medium">{permittedLabel(path)}</span>
                  <span className="text-sm text-muted-foreground">{PERMITTED_LABELS[path].description}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Every detail follows the shared design. Your fit and your measurements are your own.
            </p>
          )}
        </AtelierSection>

        <AtelierSection id="sharing" title="What the organizer will see" description={PARTICIPANT_ISOLATION}>
          <div className="divide-y divide-foreground/10 border-y border-foreground/15">
            <ConsentRow
              id={`${id}-style`}
              label="Share whether my design is ready"
              description="The organizer learns that your design names a cloth — not what you chose."
              checked={shareStyle}
              onChange={setShareStyle}
              disabled={pending}
            />
            <ConsentRow
              id={`${id}-fit`}
              label="Share whether a fitter has approved my fit"
              description="The organizer learns that a fitter approved your profile — never a measurement."
              checked={shareFit}
              onChange={setShareFit}
              disabled={pending}
            />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Both are off unless you turn them on here.
          </p>
        </AtelierSection>
      </div>

      <section aria-label="Join" className="space-y-4 border-t border-foreground/15 pt-6">
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Joining makes a private design from the shared brief, saved to {signedIn ? "your account" : "this browser"}.
          Nothing is sent to the house until you request a quote.
        </p>
        {!signedIn && !storageAvailable ? (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            This browser is not keeping drafts — sign in to keep your design, or download it before you leave.
          </p>
        ) : null}

        {error ? (
          <div className="space-y-3">
            <ErrorAlert
              title="Could not join the group"
              message={error.message}
              onRetry={
                error.code === "NOT_FOUND" || error.code === "INVALID_STATE" ? undefined : () => void handleJoin()
              }
            />
            {error.code === "UNAUTHENTICATED" ? (
              <p className="text-sm">
                <Link href={signInHref(pathname)} className="underline underline-offset-4">
                  Sign in
                </Link>{" "}
                to join from your account.
              </p>
            ) : null}
            {error.code === "NOT_FOUND" || error.code === "INVALID_STATE" ? (
              <p className="text-sm">
                <Link href={routes.atelier.drafts} className="underline underline-offset-4">
                  Your drafts
                </Link>{" "}
                hold any design you accepted in this browser earlier.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            className="h-11 rounded-none px-5"
            onClick={() => void handleJoin()}
            disabled={pending || !canJoin}
            aria-busy={pending}
          >
            {pending ? <Spinner data-icon="inline-start" aria-label="Joining the group" /> : null}
            {pending ? "Joining…" : "Join and start my design"}
          </Button>
          <Link
            href={routes.atelier.home}
            className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4 hover:text-muted-foreground"
          >
            Not now
          </Link>
        </div>
        {!ready ? <StatusLine live>Preparing this browser…</StatusLine> : null}
        {ready && !canJoin ? (
          <p className="text-sm text-muted-foreground">
            This browser cannot keep a design for you.{" "}
            <Link href={signInHref(pathname)} className="underline underline-offset-4">
              Sign in
            </Link>{" "}
            to join from your account.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function ConsentRow({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex min-h-11 items-start justify-between gap-4 py-3">
      <Label htmlFor={id} className="flex-col items-start gap-1 leading-snug font-normal">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs leading-relaxed text-muted-foreground">{description}</span>
      </Label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={(next) => onChange(next)}
        disabled={disabled}
        className="mt-1"
      />
    </div>
  );
}
