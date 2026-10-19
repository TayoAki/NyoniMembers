"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  FIT_PROFILE_STATUS_LABELS,
  FIT_ROUTE_LABELS,
  FIT_ROUTES,
  type FitProfileStatus,
  type FitRoute,
} from "@convex/shared/atelier/enums";
import { HOUSE_POLICY } from "@convex/shared/atelier/policy";
import { HOUSE, SHOWROOMS } from "@convex/shared/house";
import { StatusLine, type StatusTone } from "@/components/atelier/common/status-line";
import { useStudio } from "@/components/atelier/studio/panel-contract";
import { AccountBoundary } from "@/components/atelier/studio/review/account-boundary";
import { ReviewBlockSkeleton } from "@/components/atelier/studio/review/review-skeleton";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { useAtelierViewer } from "@/hooks/atelier/use-atelier-viewer";
import { reportError, type ClientError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

/** What each route involves, in plain words. Facts about the house come from `HOUSE_POLICY` and `SHOWROOMS`. */
const ROUTE_WHAT: Record<FitRoute, string> = {
  atelier:
    "A clothier takes your measurements in person and fits the suit as it is made: a private consultation first, a final fitting before delivery, more if the garment needs them.",
  remote:
    "You measure at home with the guided sheet and a fitter reviews every value before anything is cut. A virtual appointment can go over the sheet with you.",
  undecided:
    "Tell the house where you are and when you need the suit. Your concierge recommends a route, in a showroom or by video, before anything is booked.",
};
const ROUTE_BRING: Record<FitRoute, string> = {
  atelier: "Bring the shoes and a shirt you would wear with the suit, and your date if there is one.",
  remote: "You will need a soft tape measure, a shirt and trousers that fit well, and someone to help with the back.",
  undecided: "Nothing yet. Your concierge will tell you what the chosen route needs.",
};

const PROFILE_TONES: Record<FitProfileStatus, StatusTone> = {
  provisional: "neutral",
  needs_clarification: "warning",
  approved: "gold",
  superseded: "neutral",
};

const PREVIEW_NEVER_MEASURES =
  "A personal preview shows cloth and cut on your photograph. It never measures you: measurements come from a fitting or from the guided sheet, reviewed by a fitter.";

function signInHref(returnTo: string): string {
  return `${routes.signIn}?redirect_url=${encodeURIComponent(returnTo)}`;
}

function isFitRoute(value: unknown): value is FitRoute {
  return typeof value === "string" && (FIT_ROUTES as readonly string[]).includes(value);
}

/**
 * The fit step (S19 in the studio, C15): how the house will measure the client, as a preference saved
 * with the design. Not an appointment, not a profile, and never a size read off a photograph. The
 * profile and the guided sheet live on /atelier/fit; a fitting is requested on /atelier/fittings.
 */
export function FitPanel() {
  const { draft, draftId, guestKeyArg, goToStep } = useStudio();
  const setFitRoute = useMutation(api.atelier.drafts.setFitRoute);
  const [pendingRoute, setPendingRoute] = useState<FitRoute | null>(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<ClientError | null>(null);

  const locked = draft.status !== "draft";
  const selected = pendingRoute ?? draft.fitRoute;

  async function choose(route: FitRoute) {
    if (locked || route === draft.fitRoute) return;
    setPendingRoute(route);
    setSaving(true);
    setFailure(null);
    try {
      await setFitRoute({ draftId, ...guestKeyArg, fitRoute: route });
      setPendingRoute(null);
    } catch (error) {
      setFailure(reportError(error));
    } finally {
      setSaving(false);
    }
  }

  function keepSaved() {
    setPendingRoute(null);
    setFailure(null);
  }

  return (
    <div className="space-y-8">
      <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
        Choose how the house measures you. The route is saved with this design as a preference; it books nothing and
        changes nothing in your design or your measurements.
      </p>

      <FieldSet>
        <FieldLegend variant="label">Your route</FieldLegend>
        <RadioGroup
          value={selected ?? ""}
          onValueChange={(value) => {
            if (isFitRoute(value)) void choose(value);
          }}
          className="gap-0 divide-y divide-foreground/10 border-y border-foreground/15"
          aria-label="Fit route"
          disabled={locked || saving}
        >
          {FIT_ROUTES.map((route) => (
            <FieldLabel
              key={route}
              className={cn(
                "flex w-full cursor-pointer items-start gap-3 py-4 pr-2 pl-1 font-normal",
                selected === route && "bg-primary/5",
              )}
            >
              <RadioGroupItem value={route} className="mt-1" />
              <span className="min-w-0 flex-1 space-y-2">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-sm font-medium">{FIT_ROUTE_LABELS[route]}</span>
                  {pendingRoute === route && saving ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Spinner className="size-3" aria-hidden />
                      Saving…
                    </span>
                  ) : draft.fitRoute === route && !pendingRoute ? (
                    <span className="text-xs text-muted-foreground">Your choice</span>
                  ) : null}
                </span>
                <span className="block text-xs leading-relaxed text-pretty text-muted-foreground">
                  {ROUTE_WHAT[route]}
                </span>
                <span className="block text-xs leading-relaxed text-pretty text-muted-foreground">
                  {ROUTE_BRING[route]}
                </span>
                {route === "atelier" ? <Showrooms /> : null}
              </span>
            </FieldLabel>
          ))}
        </RadioGroup>
      </FieldSet>

      {failure ? (
        <ErrorAlert
          title="Could not save your route"
          message={`${failure.message} Your choice is still here.`}
          onRetry={pendingRoute ? () => void choose(pendingRoute) : undefined}
          retryLabel="Save again"
          className="rounded-none"
        />
      ) : null}
      {failure && pendingRoute ? (
        <Button
          variant="ghost"
          className="-mt-6 h-11 rounded-none px-3 underline underline-offset-4"
          onClick={keepSaved}
        >
          Keep {draft.fitRoute ? FIT_ROUTE_LABELS[draft.fitRoute].toLowerCase() : "no route"} instead
        </Button>
      ) : null}

      <p className="text-xs leading-relaxed text-pretty text-muted-foreground">{PREVIEW_NEVER_MEASURES}</p>

      <section aria-labelledby="fit-profile-title" className="space-y-3 border-t border-foreground/15 pt-6">
        <h3 id="fit-profile-title" className="text-base font-medium tracking-tight">
          Your fit profile
        </h3>
        <FitProfileBlock draftId={draftId} guestKeyArg={guestKeyArg} />
      </section>

      <section aria-labelledby="fit-next-title" className="space-y-3 border-t border-foreground/15 pt-6">
        <h3 id="fit-next-title" className="text-base font-medium tracking-tight">
          Fittings
        </h3>
        <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
          {HOUSE_POLICY.verified.fittings} A fitting is requested, then confirmed by the house; no slot is promised
          here.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="h-11 rounded-none px-4"
            nativeButton={false}
            render={<Link href={routes.atelier.fittings} />}
          >
            Request a fitting
          </Button>
          <Button variant="outline" className="h-11 rounded-none px-4" onClick={() => goToStep("review")}>
            Continue to review
          </Button>
        </div>
      </section>
    </div>
  );
}

function Showrooms() {
  return (
    <span className="block pt-1">
      <span className="block font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">Showrooms</span>
      <span className="mt-1 block divide-y divide-foreground/10 text-xs">
        {SHOWROOMS.map((showroom) => (
          <span key={showroom.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-1.5">
            <span className="font-medium text-foreground">{showroom.city}</span>
            <span className="text-muted-foreground">{showroom.address}</span>
            <span className="text-muted-foreground">{showroom.phone}</span>
          </span>
        ))}
        <span className="block py-1.5 text-muted-foreground">{HOUSE.hours}</span>
      </span>
    </span>
  );
}

/**
 * The account's fit profile against this design (C16): approved profiles can be attached; anything else
 * is named with its status. Guests are told where measurements live; the design works without them.
 */
function FitProfileBlock({
  draftId,
  guestKeyArg,
}: {
  draftId: Id<"atelierDrafts">;
  guestKeyArg: { guestKey?: string };
}) {
  const { draft } = useStudio();
  const { status, convexReady } = useAtelierViewer();

  const attached = draft.fitProfile ? (
    <StatusLine tone={PROFILE_TONES[draft.fitProfile.status]}>
      Using your fit profile v{draft.fitProfile.version} · {FIT_PROFILE_STATUS_LABELS[draft.fitProfile.status]}
    </StatusLine>
  ) : null;

  if (status === "loading") {
    return (
      <div className="space-y-3">
        {attached}
        <ReviewBlockSkeleton />
      </div>
    );
  }

  if (status === "signed_out") {
    return (
      <div className="space-y-3">
        {attached}
        <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
          Measurements are kept on an account, never in a browser, and a fitter approves every profile before it is
          used. You can keep designing without one.
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link
            href={signInHref(routes.atelier.fit)}
            className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4 hover:text-muted-foreground"
          >
            Sign in to save measurements
          </Link>
          <Link
            href={routes.atelier.fit}
            className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 hover:text-muted-foreground"
          >
            How the house measures
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AccountBoundary
      fallback={
        <div className="space-y-3">
          {attached}
          <StatusLine tone="warning">Could not read your fit profile right now</StatusLine>
          <ProfileLinks />
        </div>
      }
    >
      <MyProfile draftId={draftId} guestKeyArg={guestKeyArg} enabled={convexReady} attached={attached} />
    </AccountBoundary>
  );
}

function ProfileLinks({ measure = false }: { measure?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <Link
        href={routes.atelier.fit}
        className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4 hover:text-muted-foreground"
      >
        {measure ? "Measure at home with the guide" : "Your fit profile"}
      </Link>
    </div>
  );
}

function MyProfile({
  draftId,
  guestKeyArg,
  enabled,
  attached,
}: {
  draftId: Id<"atelierDrafts">;
  guestKeyArg: { guestKey?: string };
  enabled: boolean;
  attached: ReactNode;
}) {
  const { draft } = useStudio();
  const profile = useQuery(api.atelier.fit.myProfile, enabled ? {} : "skip");
  const confirmReuse = useMutation(api.atelier.fit.confirmReuse);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ClientError | null>(null);

  if (profile === undefined) {
    return (
      <div className="space-y-3">
        {attached}
        <ReviewBlockSkeleton />
      </div>
    );
  }

  if (profile === null) {
    return (
      <div className="space-y-3">
        {attached}
        <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
          No fit profile on your account yet. A showroom fitting records one for you, or you can measure at home with
          the guide and a fitter will review it.
        </p>
        <ProfileLinks measure />
      </div>
    );
  }

  const current = profile;
  const alreadyAttached = draft.fitProfile?.version === current.version;
  const canAttach = current.status === "approved" && !alreadyAttached && draft.status === "draft";

  async function attach() {
    setPending(true);
    setFailure(null);
    try {
      await confirmReuse({ ...guestKeyArg, profileId: current._id, draftId });
    } catch (error) {
      setFailure(reportError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      {attached}
      {!alreadyAttached ? (
        <StatusLine tone={PROFILE_TONES[profile.status]}>
          Your latest profile · v{profile.version} · {FIT_PROFILE_STATUS_LABELS[profile.status]}
        </StatusLine>
      ) : null}
      {profile.status !== "approved" ? (
        <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
          Only a profile a fitter has approved can be attached to a design. Your concierge will settle the fit with you
          if it is still under review when you ask for a quote.
        </p>
      ) : null}
      {canAttach && !draft.ownedByAccount ? (
        <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
          This design is saved to this browser. Save it to your account first, then attach your profile.{" "}
          <Link href={routes.atelier.link} className="underline underline-offset-4 hover:text-foreground">
            Save to my account
          </Link>
        </p>
      ) : null}
      {failure ? (
        <ErrorAlert
          title="Could not attach your profile"
          message={`${failure.message} Your design is unchanged.`}
          onRetry={failure.code === "INVALID_STATE" ? undefined : () => void attach()}
          className="rounded-none"
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {canAttach && draft.ownedByAccount ? (
          <Button className="h-11 rounded-none px-4" onClick={() => void attach()} disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" aria-label="Attaching" /> : null}
            Use fit profile v{profile.version} for this design
          </Button>
        ) : null}
        <ProfileLinks />
      </div>
    </div>
  );
}
