"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@convex/_generated/api";
import { HOUSE } from "@convex/shared/house";
import { StatusLine } from "@/components/atelier/common/status-line";
import { useAtelierViewer } from "@/hooks/atelier/use-atelier-viewer";
import { routes } from "@/lib/routes";
import { AccountBoundary } from "./account-boundary";
import { ReviewBlockSkeleton } from "./review-skeleton";

const CONCIERGE_APPLIES = "Your concierge will apply your membership to the quote. Browsing never reserves a suit.";

/**
 * The annual suit as the house records it (C14, S24): read from the account, never from a label on the
 * screen. Guests are told what signing in would show; nothing here reserves or redeems anything.
 */
export function ReviewEligibility() {
  const { status, convexReady } = useAtelierViewer();
  if (status === "loading") return <ReviewBlockSkeleton />;
  if (status === "signed_out") return <SignedOut />;
  return (
    <AccountBoundary fallback={<Unavailable />}>
      <EligibilityRows enabled={convexReady} />
    </AccountBoundary>
  );
}

function SignedOut() {
  const pathname = usePathname();
  return (
    <div className="space-y-2">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Members of {HOUSE.programName}:{" "}
        <Link
          href={`${routes.signIn}?redirect_url=${encodeURIComponent(pathname)}`}
          className="underline underline-offset-4 hover:text-foreground"
        >
          sign in
        </Link>{" "}
        and the house reads your tier from its own record. {CONCIERGE_APPLIES}
      </p>
      <a
        href={HOUSE.membershipUrl}
        rel="noreferrer"
        className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 hover:text-muted-foreground"
      >
        About {HOUSE.programName}
      </a>
    </div>
  );
}

function Unavailable() {
  return (
    <div className="space-y-2">
      <StatusLine tone="warning">Could not read your membership right now</StatusLine>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Nothing is assumed in the meantime. {CONCIERGE_APPLIES}
      </p>
    </div>
  );
}

function EligibilityRows({ enabled }: { enabled: boolean }) {
  const eligibility = useQuery(api.atelier.benefits.myEligibility, enabled ? {} : "skip");
  if (eligibility === undefined) return <ReviewBlockSkeleton />;

  const member = eligibility.tier !== "client";
  const headline = !member
    ? `${eligibility.tierLabel} account · no annual suit`
    : eligibility.available
      ? `${eligibility.tierLabel} · a suit is included this membership year`
      : eligibility.redemption
        ? `${eligibility.tierLabel} · ${eligibility.redemption.statusLabel}`
        : `${eligibility.tierLabel} · ${eligibility.status === "lapsed" ? "membership lapsed" : "no suit available this year"}`;

  return (
    <div className="space-y-2">
      <StatusLine tone={eligibility.available ? "gold" : "neutral"}>{headline}</StatusLine>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {eligibility.reason}
        {eligibility.cloth ? ` The included suit is cut in ${eligibility.cloth}.` : ""} {CONCIERGE_APPLIES}
      </p>
      <Link
        href={routes.atelier.membership}
        className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 hover:text-muted-foreground"
      >
        Your membership
      </Link>
    </div>
  );
}
