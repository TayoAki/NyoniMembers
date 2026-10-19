"use client";

import { useQuery } from "convex/react";
import { Ruler } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { Mono } from "@/components/atelier/common/mono";
import { OrderBook, OrderBookRow, OrderBookSection } from "@/components/atelier/common/order-book";
import { StatusLine } from "@/components/atelier/common/status-line";
import { FitBoundary } from "@/components/atelier/fit/fit-boundary";
import { FitPhotoList } from "@/components/atelier/fit/fit-photos";
import { ProfileSkeleton } from "@/components/atelier/fit/fit-skeleton";
import { PROFILE_TONES, signInHref, type Viewer } from "@/components/atelier/fit/fit-words";
import { ProfileHistory } from "@/components/atelier/fit/profile-history";
import { UnitToggle } from "@/components/atelier/fit/unit-toggle";
import { UseProfileDialog } from "@/components/atelier/fit/use-profile-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { UNIT_LABELS } from "@/hooks/atelier/use-measurement-form";
import { formatDate, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { FitProfileView } from "@convex/atelier/fit";
import {
  formatMeasurement,
  JACKET_COMFORT_LABELS,
  MEASUREMENT_FIELDS,
  MEASUREMENT_GROUP_LABELS,
  MOVEMENT_LABELS,
  POSTURE_LABELS,
  TROUSER_COMFORT_LABELS,
  type MeasurementGroup,
  type Unit,
} from "@convex/shared/atelier/measurements";

const GROUPS = Object.keys(MEASUREMENT_GROUP_LABELS) as MeasurementGroup[];

type Props = {
  viewer: Viewer;
  /** Where sign-in returns to. */
  returnTo: string;
  onStartRevision: (profile: FitProfileView) => void;
  onMeasure: () => void;
};

/**
 * S20 (C16): the account's current fit profile version, as the house holds it. Signed-out visitors
 * are told what a profile is and that the design does not depend on it; nothing is assumed.
 */
export function FitProfilePanel({ viewer, returnTo, onStartRevision, onMeasure }: Props) {
  if (viewer.status === "loading") return <ProfileSkeleton />;
  if (viewer.status === "signed_out") return <SignedOut returnTo={returnTo} onMeasure={onMeasure} />;
  return (
    <FitBoundary fallback={<Unavailable />}>
      <ProfileLoader enabled={viewer.convexReady} onStartRevision={onStartRevision} onMeasure={onMeasure} />
    </FitBoundary>
  );
}

function SignedOut({ returnTo, onMeasure }: { returnTo: string; onMeasure: () => void }) {
  return (
    <section aria-labelledby="fit-signed-out" className="space-y-4">
      <h2 id="fit-signed-out" className="text-xl font-medium tracking-tight">
        Sign in to see your fit profile
      </h2>
      <p className="max-w-2xl text-sm leading-relaxed text-pretty text-muted-foreground">
        A fit profile belongs to an account, so only you and the fitter who reviews it can see your measurements. Your
        design does not depend on it: keep designing, and attach a profile when you request a quote. A fitter approves
        every profile before the house cuts against it.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          className="h-11 rounded-none px-5"
          render={<Link href={signInHref(returnTo)} />}
          nativeButton={false}
        >
          Sign in
        </Button>
        <Button variant="ghost" className="h-11 rounded-none px-4" onClick={onMeasure}>
          Read the measurement guide
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        You can design without signing in; your work waits in this browser.
      </p>
    </section>
  );
}

function Unavailable() {
  return (
    <section aria-labelledby="fit-unavailable" className="space-y-3">
      <h2 id="fit-unavailable" className="text-xl font-medium tracking-tight">
        Your fit profile is not available right now
      </h2>
      <StatusLine tone="warning">Could not read your fit profile</StatusLine>
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Nothing is assumed in the meantime. Your measurements stay as the house holds them; reload to try again, or ask
        your concierge.
      </p>
    </section>
  );
}

function ProfileLoader({
  enabled,
  onStartRevision,
  onMeasure,
}: {
  enabled: boolean;
  onStartRevision: (profile: FitProfileView) => void;
  onMeasure: () => void;
}) {
  const profile = useQuery(api.atelier.fit.myProfile, enabled ? {} : "skip");
  const history = useQuery(api.atelier.fit.listMyProfiles, enabled ? {} : "skip");
  if (profile === undefined) return <ProfileSkeleton />;
  if (profile === null) return <NoProfile onMeasure={onMeasure} />;
  return <ProfileView profile={profile} history={history} onStartRevision={onStartRevision} />;
}

function NoProfile({ onMeasure }: { onMeasure: () => void }) {
  return (
    <EmptyState
      icon={Ruler}
      title="No fit profile yet"
      description={
        <>
          Measure at home with the guide, or{" "}
          <Link href={routes.atelier.fittings} className="underline underline-offset-4">
            ask for a fitting at a showroom
          </Link>
          . A fitter approves every profile before the house cuts anything against it.
        </>
      }
      action={
        <Button className="h-11 rounded-none px-5" onClick={onMeasure}>
          Measure at home
        </Button>
      }
      className="rounded-none"
    />
  );
}

function ProfileView({
  profile,
  history,
  onStartRevision,
}: {
  profile: FitProfileView;
  history: FitProfileView[] | undefined;
  onStartRevision: (profile: FitProfileView) => void;
}) {
  const [unit, setUnit] = useState<Unit>(profile.units);
  const approved = profile.status === "approved";
  const missing = new Set(profile.missingRequired);
  const uncertain = new Set(profile.uncertainFields);
  const implausible = new Set(profile.implausible);

  return (
    <div className="space-y-8">
      <section aria-labelledby="fit-profile-title" className="space-y-5">
        <div className="space-y-2">
          <h2
            id="fit-profile-title"
            className="flex flex-wrap items-baseline gap-x-3 text-xl font-medium tracking-tight sm:text-2xl"
          >
            Fit profile
            <Mono upper={false} className="text-sm text-foreground">
              v{profile.version}
            </Mono>
          </h2>
          <StatusLine tone={PROFILE_TONES[profile.status]} live className="text-sm">
            {profile.statusLabel}
          </StatusLine>
        </div>

        <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-3">
          <Fact label="Source" value={profile.provenanceLabel} />
          <Fact
            label="Reviewed"
            value={
              profile.reviewedAt
                ? `${profile.reviewer ? `By ${profile.reviewer}, ` : ""}${formatDate(profile.reviewedAt)}`
                : "Not yet reviewed"
            }
          />
          <Fact
            label="Submitted"
            value={`${formatDate(profile.createdAt)} · ${UNIT_LABELS[profile.units].toLowerCase()}`}
          />
        </dl>

        {profile.reviewNote ? (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Fitter’s note.</span> {profile.reviewNote}
          </p>
        ) : null}

        {profile.status === "needs_clarification" && profile.clarification ? (
          <Alert className="rounded-none">
            <AlertTitle>A fitter has a question</AlertTitle>
            <AlertDescription>
              <p>“{profile.clarification}”</p>
              <p>
                Answer in the notes of a revision, or adjust the values the question is about. The fitter sees both.
              </p>
              <Button variant="outline" size="sm" className="rounded-none" onClick={() => onStartRevision(profile)}>
                Answer and revise
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {profile.missingRequired.length > 0 ? (
          <StatusLine tone="warning">
            {pluralize(profile.missingRequired.length, "required measurement is", "required measurements are")} still
            missing; a profile cannot be approved until a fitter has them
          </StatusLine>
        ) : null}

        <div className="space-y-2">
          <div className="flex flex-wrap items-start gap-3">
            <UseProfileDialog profile={profile} />
            <Button variant="outline" className="h-11 rounded-none px-5" onClick={() => onStartRevision(profile)}>
              Start a revision
            </Button>
          </div>
          <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
            {approved
              ? "A revision becomes a new version for a fitter to review; this approved version stays as it is until then, and a commission already released keeps the version it was cut against."
              : "A revision starts a new version from these values and takes this one's place in the fitter's queue."}
          </p>
        </div>
      </section>

      <AtelierSection
        id="fit-measurements"
        title="Measurements"
        description={
          profile.approvedValues
            ? "As you submitted them. Where the fitter settled on a different value, it is shown beside yours."
            : "As you submitted them, before review. Values are kept in centimetres; the display rounds to the nearest 0.5 cm or quarter inch."
        }
        actions={<UnitToggle unit={unit} onChange={setUnit} />}
      >
        <OrderBook>
          {GROUPS.map((group) => (
            <div key={group}>
              <OrderBookSection>{MEASUREMENT_GROUP_LABELS[group]}</OrderBookSection>
              {MEASUREMENT_FIELDS.filter((field) => field.group === group).map((field) => {
                const submitted = profile.measurements[field.key];
                const fitter = profile.approvedValues?.[field.key];
                const notes: ReactNode[] = [];
                if (fitter !== undefined && fitter !== submitted) {
                  notes.push(<span key="fitter">Fitter’s value: {formatMeasurement(fitter, unit)}</span>);
                }
                if (uncertain.has(field.key))
                  notes.push(<span key="unsure">You marked this as one you were unsure of.</span>);
                if (implausible.has(field.key))
                  notes.push(<span key="check">Outside the usual range; flagged for the fitter.</span>);
                if (missing.has(field.key))
                  notes.push(<span key="missing">Required before a fitter can approve the profile.</span>);
                return (
                  <OrderBookRow
                    key={field.key}
                    label={field.label}
                    value={submitted !== undefined ? formatMeasurement(submitted, unit) : "Not given"}
                    tone={submitted === undefined ? "muted" : implausible.has(field.key) ? "warning" : "default"}
                    note={notes.length ? <span className="flex flex-col gap-0.5">{notes}</span> : undefined}
                  />
                );
              })}
            </div>
          ))}
        </OrderBook>
      </AtelierSection>

      <AtelierSection
        id="fit-comfort"
        title="Comfort and movement"
        description="Recorded explicitly so the fitter allows for how the suit will be worn."
      >
        <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
          <Fact label="Jacket" value={JACKET_COMFORT_LABELS[profile.comfort.jacket]} />
          <Fact label="Trousers" value={TROUSER_COMFORT_LABELS[profile.comfort.trousers]} />
          <Fact
            label="Movement"
            value={
              profile.comfort.movement.length
                ? profile.comfort.movement.map((movement) => MOVEMENT_LABELS[movement]).join(", ")
                : "Not given"
            }
          />
          <Fact label="Posture" value={profile.posture ? POSTURE_LABELS[profile.posture] : "Not given"} />
        </dl>
        {profile.notes ? (
          <div className="mt-5 space-y-1">
            <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">Your notes</p>
            <p className="max-w-2xl text-sm leading-relaxed whitespace-pre-line">{profile.notes}</p>
          </div>
        ) : null}
      </AtelierSection>

      <AtelierSection
        id="fit-photos"
        title="Posture photographs"
        description="Private: seen only by the fitter reviewing this version, never used for previews. Remove any of them at any time."
      >
        <FitPhotoList photos={profile.photos} />
      </AtelierSection>

      <AtelierSection
        id="fit-history"
        title="History"
        description="Every version is kept. Nothing is edited in place; a fitter's approval of a new version supersedes the one before."
      >
        <ProfileHistory entries={history} currentId={profile._id} />
      </AtelierSection>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">{label}</dt>
      <dd className="leading-relaxed">{value}</dd>
    </div>
  );
}
