"use client";

import { useQuery } from "convex/react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/common/page-header";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { EligibilityBoundary } from "@/components/atelier/membership/eligibility-boundary";
import { myEligibilityRef, REDEMPTION_WORDS, type Eligibility } from "@/components/atelier/membership/eligibility";
import { AtelierMembershipSkeleton } from "@/components/atelier/membership/membership-skeleton";
import { Button } from "@/components/ui/button";
import { useAtelierViewer } from "@/hooks/atelier/use-atelier-viewer";
import { formatDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import { HOUSE_POLICY } from "@convex/shared/atelier/policy";
import { HOUSE } from "@convex/shared/house";
import { TIER_CLOTH, TIER_LABELS } from "@convex/shared/membership";

const TITLE = "Your membership and the annual suit.";
const BROWSING_NEVER_RESERVES =
  "Browsing never reserves your suit. Your concierge applies your membership to the quote, and the receipt shows it.";

/** S18: the annual suit as the house's record states it. Signed-in only; guests are told why. */
export function MembershipBenefit() {
  const { status, convexReady } = useAtelierViewer();
  if (status === "loading") return <AtelierMembershipSkeleton />;
  if (status === "signed_out") return <SignedOut />;
  return (
    <EligibilityBoundary fallback={<Unavailable />}>
      <EligibilityPanel enabled={convexReady} />
    </EligibilityBoundary>
  );
}

function Frame({ description, children }: { description: string; children: ReactNode }) {
  return (
    <div className="space-y-8 pt-6">
      <PageHeader title={TITLE} description={description} />
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button className="h-11 rounded-none px-5" render={<Link href={routes.atelier.home} />} nativeButton={false}>
          Start designing
        </Button>
        <Link
          href={routes.atelier.drafts}
          className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4 hover:text-muted-foreground"
        >
          Your drafts
        </Link>
      </div>
    </div>
  );
}

function MembershipLink() {
  return (
    <a
      href={HOUSE.membershipUrl}
      className="inline-flex min-h-11 items-center gap-1 text-sm font-medium underline underline-offset-4 hover:text-muted-foreground"
      rel="noreferrer"
    >
      {HOUSE.programName} at nyonicouture.com <ArrowUpRight className="size-4" aria-hidden />
    </a>
  );
}

function SignedOut() {
  return (
    <Frame description="Membership is read from your account, as the house recorded it. Sign in to see your tier and whether this year's suit is included.">
      <section aria-labelledby="membership-signed-out" className="space-y-4 border-y border-foreground/15 py-6">
        <h2 id="membership-signed-out" className="text-xl font-medium tracking-tight">
          Sign in to see your membership
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {HOUSE.programName} includes one made-to-measure suit each membership year, cut in Nyoni Fabric by tier.
          Nothing on this page is assumed: eligibility comes from the house&rsquo;s record of your account, and{" "}
          {BROWSING_NEVER_RESERVES.charAt(0).toLowerCase()}
          {BROWSING_NEVER_RESERVES.slice(1)}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Button
            variant="outline"
            className="h-11 rounded-none px-5"
            render={<Link href={`${routes.signIn}?redirect_url=${encodeURIComponent(routes.atelier.membership)}`} />}
            nativeButton={false}
          >
            Sign in
          </Button>
          <MembershipLink />
        </div>
        <p className="text-xs text-muted-foreground">
          You can design without signing in; your work waits in this browser.
        </p>
      </section>
    </Frame>
  );
}

function Unavailable() {
  return (
    <Frame description="Membership is read from your account, as the house recorded it.">
      <section aria-labelledby="membership-unavailable" className="space-y-3 border-y border-foreground/15 py-6">
        <h2 id="membership-unavailable" className="text-xl font-medium tracking-tight">
          Eligibility is not available right now
        </h2>
        <StatusLine tone="warning">Could not read your membership</StatusLine>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Nothing is assumed in the meantime. {BROWSING_NEVER_RESERVES}
        </p>
        <MembershipLink />
      </section>
    </Frame>
  );
}

function EligibilityPanel({ enabled }: { enabled: boolean }) {
  const eligibility = useQuery(myEligibilityRef, enabled ? {} : "skip");
  if (eligibility === undefined) return <AtelierMembershipSkeleton />;
  return <EligibilityView eligibility={eligibility} />;
}

function EligibilityView({ eligibility }: { eligibility: Eligibility }) {
  const { tier, status, included, yearKey, redemption, reason } = eligibility;
  const member = tier !== "client";
  const cloth = TIER_CLOTH[tier];
  const active = status === "active";

  return (
    <Frame description="As the house recorded it on your account. Your concierge sees the same record.">
      <section
        aria-labelledby="membership-tier"
        className="grid border-y border-foreground/15 md:grid-cols-[1.1fr_1fr]"
      >
        <div className="space-y-4 py-7 md:pr-10">
          <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
            {member ? HOUSE.programName : "Your account"}
          </p>
          <h2
            id="membership-tier"
            className="font-display text-[3.25rem] leading-none font-medium tracking-[-0.01em] sm:text-[4.5rem]"
          >
            {TIER_LABELS[tier]}
          </h2>
          {member ? <StatusLine tone={active ? "gold" : "warning"}>{active ? "Active" : "Lapsed"}</StatusLine> : null}
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            {member && cloth
              ? `One made-to-measure suit each membership year, cut in ${cloth}.`
              : `${HOUSE.programName} includes one made-to-measure suit each membership year. A client account has no suit included; membership is joined with the house.`}
          </p>
          {!member ? <MembershipLink /> : null}
        </div>
        <dl className="space-y-5 border-t border-foreground/15 py-7 md:border-t-0 md:border-l md:pl-10">
          <div className="space-y-1.5">
            <dt className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              This membership year
            </dt>
            <dd className="space-y-1">
              <StatusLine tone={included ? "gold" : "neutral"}>
                {included ? "Your suit is included" : "No suit included"}
              </StatusLine>
              <Mono>Year {yearKey}</Mono>
            </dd>
          </div>
          {redemption ? (
            <div className="space-y-1.5">
              <dt className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
                The annual suit
              </dt>
              <dd className="space-y-1">
                <StatusLine tone={redemption.status === "redeemed" ? "gold" : "neutral"}>
                  {REDEMPTION_WORDS[redemption.status]}
                </StatusLine>
                <p className="text-xs text-muted-foreground">
                  {redemption.status === "reserved" ? `Reserved ${formatDate(redemption.reservedAt)}` : null}
                  {redemption.status === "redeemed" && redemption.redeemedAt
                    ? `Used ${formatDate(redemption.redeemedAt)}`
                    : null}
                  {redemption.status === "released" && redemption.releasedAt
                    ? `Released ${formatDate(redemption.releasedAt)}`
                    : null}
                  {redemption.orderId ? (
                    <>
                      {" · "}
                      <Link href={routes.atelier.order(redemption.orderId)} className="underline underline-offset-4">
                        See the commission
                      </Link>
                    </>
                  ) : null}
                </p>
              </dd>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <dt className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">Why</dt>
            <dd className="text-sm leading-relaxed">{reason}</dd>
          </div>
          {member ? (
            <div className="space-y-1.5">
              <dt className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">Alterations</dt>
              <dd className="text-sm leading-relaxed text-muted-foreground">
                {HOUSE_POLICY.verified.memberAlterations}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{BROWSING_NEVER_RESERVES}</p>
    </Frame>
  );
}
