"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { PROFILE_TONES, signInHref, type Viewer } from "@/components/atelier/fit/fit-words";
import { PrivacyBoundary } from "@/components/atelier/privacy/privacy-boundary";
import { PrivacyRows } from "@/components/atelier/privacy/privacy-skeleton";
import { FIT_RECORDS_SENTENCE } from "@/components/atelier/privacy/privacy-words";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";

/**
 * S34 · Fit records: the account's fit profile versions, read-only, with the plain statement of what is
 * kept and why. Guests hold no measurement in this browser and are told so.
 */
export function FitRecordsSection({ viewer }: { viewer: Viewer }) {
  return (
    <AtelierSection id="fit-records" title="Fit records" description={FIT_RECORDS_SENTENCE}>
      {viewer.status === "loading" ? (
        <PrivacyRows count={2} />
      ) : viewer.status === "signed_out" ? (
        <SignedOut />
      ) : (
        <PrivacyBoundary fallback={<Unavailable />}>
          <FitRecords enabled={viewer.convexReady} />
        </PrivacyBoundary>
      )}
    </AtelierSection>
  );
}

function SignedOut() {
  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Fit records belong to an account. Nothing in this browser holds a measurement, and no measurement is read from a
        photograph. Sign in to see the profiles a fitter has reviewed for you.
      </p>
      <Button
        variant="outline"
        className="h-11 rounded-none px-5"
        render={<Link href={signInHref(routes.atelier.privacy)} />}
        nativeButton={false}
      >
        Sign in
      </Button>
    </div>
  );
}

function Unavailable() {
  return (
    <div className="space-y-2">
      <StatusLine tone="warning">Could not read your fit records</StatusLine>
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Nothing is assumed in the meantime. Your profiles are also listed under{" "}
        <Link href={routes.atelier.fit} className="underline underline-offset-4">
          Fit
        </Link>
        .
      </p>
    </div>
  );
}

function FitRecords({ enabled }: { enabled: boolean }) {
  const profiles = useQuery(api.atelier.fit.listMyProfiles, enabled ? {} : "skip");
  if (profiles === undefined) return <PrivacyRows count={2} />;
  if (profiles.length === 0) {
    return (
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        No fit profile is on your account. One is made at a showroom or from the guided sheet under{" "}
        <Link href={routes.atelier.fit} className="underline underline-offset-4">
          Fit
        </Link>
        .
      </p>
    );
  }
  return (
    <ul className="divide-y divide-foreground/10 border-y border-foreground/15" aria-label="Your fit profiles">
      {profiles.map((profile) => (
        <li key={profile._id} className="grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[minmax(7rem,11rem)_1fr]">
          <div className="flex items-baseline gap-3 text-sm">
            <span className="font-medium">Profile v{profile.version}</span>
          </div>
          <div className="min-w-0 space-y-1">
            <StatusLine tone={PROFILE_TONES[profile.status]}>{profile.statusLabel}</StatusLine>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{profile.provenanceLabel}</span>
              <span>Submitted {formatDate(profile.createdAt)}</span>
              {profile.reviewer && profile.reviewedAt ? (
                <span>
                  Reviewed by {profile.reviewer} {formatDate(profile.reviewedAt)}
                </span>
              ) : null}
              <Mono upper={false}>{profile._id}</Mono>
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
