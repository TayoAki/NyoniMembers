"use client";

import { ArrowUpRight, Check, Mail, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBalance } from "@/hooks/use-credits";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatDate, formatUsd, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { HOUSE, SHOWROOMS } from "@convex/shared/house";
import {
  SUITS_PER_YEAR,
  TIER_BENEFITS,
  TIER_BLURBS,
  TIER_CLOTH,
  TIER_LABELS,
  TIER_PRICE_USD,
} from "@convex/shared/membership";
import { MembershipSkeleton } from "./membership-skeleton";

/** The member's tier as the house recorded it, what it includes, and the way to a person. */
export function MembershipOverview() {
  const { user, isLoading } = useCurrentUser();
  const { balance } = useBalance();
  if (isLoading || !user) return <MembershipSkeleton />;

  const { membership } = user;
  const isMember = membership.tier !== "client";
  const suits = SUITS_PER_YEAR[membership.tier];
  const cloth = TIER_CLOTH[membership.tier];
  const price = TIER_PRICE_USD[membership.tier];
  const active = membership.status === "active";

  return (
    <div className="space-y-8">
      <section className="grid border-y border-foreground/20 md:grid-cols-[1.1fr_1fr]" aria-label="Your membership">
        <div className="flex flex-col justify-between gap-8 py-7 md:pr-10">
          <div>
            <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              {isMember ? "The Nyoni Circle" : "Your account"}
            </p>
            <p className="mt-4 font-display text-[3.5rem] leading-none font-medium tracking-[-0.01em] sm:text-[5rem]">
              {TIER_LABELS[membership.tier]}
            </p>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              {TIER_BLURBS[membership.tier]}
            </p>
          </div>
          <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
            {isMember ? <Fact label="Status" value={active ? "Active" : "Lapsed"} warn={!active} /> : null}
            {membership.since ? <Fact label="Member since" value={formatDate(membership.since)} /> : null}
            {membership.renewsAt ? <Fact label="Renews" value={formatDate(membership.renewsAt)} /> : null}
            {suits ? <Fact label="Suits a year" value={cloth ? `${suits}, in ${cloth}` : String(suits)} /> : null}
            {price > 0 ? <Fact label="Membership" value={`${formatUsd(price)} a year`} /> : null}
          </dl>
        </div>
        <div className="space-y-5 border-t py-7 md:border-t-0 md:border-l md:pl-10">
          <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">What it includes</p>
          <ul className="space-y-2.5 text-sm leading-relaxed">
            {TIER_BENEFITS[membership.tier].map((benefit) => (
              <li key={benefit} className="flex gap-3">
                <Check className="mt-1 size-4 shrink-0 text-credit" aria-hidden />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
          {!isMember ? (
            <a
              href={HOUSE.membershipUrl}
              className="inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4 hover:text-muted-foreground"
            >
              Membership at nyonicouture.com <ArrowUpRight className="size-4" aria-hidden />
            </a>
          ) : null}
        </div>
      </section>

      <section
        id="concierge"
        className="grid scroll-mt-24 gap-8 border-b border-foreground/20 pb-8 md:grid-cols-[1.1fr_1fr]"
        aria-labelledby="concierge-title"
      >
        <div className="md:pr-10">
          <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">Your concierge</p>
          <h2 id="concierge-title" className="mt-3 text-2xl font-medium tracking-tight text-balance">
            Fittings, alterations, a commission, a question about a piece.
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            Write or text the house and a person replies. {HOUSE.hours}.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              className="h-11 rounded-none px-5"
              nativeButton={false}
              render={<a href={`mailto:${HOUSE.concierge.email}`} />}
            >
              <Mail data-icon="inline-start" aria-hidden />
              Email the house
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-none px-5"
              nativeButton={false}
              render={<a href={`sms:${HOUSE.concierge.sms}`} />}
            >
              <MessageSquare data-icon="inline-start" aria-hidden />
              Text {HOUSE.concierge.smsDisplay}
            </Button>
          </div>
        </div>
        <div>
          <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">Showrooms</p>
          <ul className="mt-3 divide-y border-y text-sm">
            {SHOWROOMS.map((showroom) => (
              <li key={showroom.id} className="flex items-baseline justify-between gap-4 py-3">
                <span className="font-medium">{showroom.city}</span>
                <span className="text-right text-muted-foreground">{showroom.address}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {balance ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {pluralize(balance.total, "preview")} available on your photo. Ask your concierge if you need more.
        </p>
      ) : null}
    </div>
  );
}

function Fact({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="space-y-1">
      <dt className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">{label}</dt>
      <dd className={cn("font-medium", warn && "text-warning")}>{value}</dd>
    </div>
  );
}
