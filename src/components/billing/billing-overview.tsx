"use client";

import { CalendarClock, Coins, Package, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useBalance } from "@/hooks/use-credits";
import { formatCredits, formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LIMITS, PLANS } from "@convex/shared/credits";
import { SummaryCardsSkeleton } from "./billing-skeleton";

export function BillingOverview() {
  const { balance, isLow } = useBalance();

  if (!balance) {
    return (
      <section className="space-y-4">
        <div className="bg-muted h-12 w-52 animate-pulse rounded-lg" />
        <SummaryCardsSkeleton />
      </section>
    );
  }

  const plan = PLANS[balance.plan];

  return (
    <section className="space-y-4" aria-label="Balance">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-muted-foreground text-sm">Available now</p>
          <p className={cn("flex items-baseline gap-2", isLow && "text-destructive")}>
            <span className="text-4xl font-semibold tracking-tight tabular-nums">{formatNumber(balance.total)}</span>
            <span className="text-muted-foreground text-base">{balance.total === 1 ? "credit" : "credits"}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isLow ? (
            <Badge variant="destructive" className="h-6 px-2.5">
              Running low — top up below
            </Badge>
          ) : null}
          <span className="text-muted-foreground text-xs tabular-nums">
            {formatCredits(balance.dailyRemaining)} left in today&rsquo;s cap of {formatNumber(LIMITS.dailyCreditCap)}
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
              <CalendarClock className="size-3.5" aria-hidden />
              Current plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-semibold tracking-tight">{plan.name}</p>
            <p className="text-muted-foreground text-sm text-pretty">{plan.blurb}</p>
          </CardContent>
          <CardFooter className="text-muted-foreground text-xs">
            {balance.planPeriodEnd
              ? `Renews on ${formatDate(balance.planPeriodEnd)}`
              : "No renewal — nothing to cancel"}
          </CardFooter>
        </Card>

        <Card className={cn(isLow && "ring-destructive/30")}>
          <CardHeader>
            <CardTitle className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
              <RefreshCw className="size-3.5" aria-hidden />
              Plan credits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-semibold tracking-tight tabular-nums">{formatNumber(balance.planCredits)}</p>
            <p className="text-muted-foreground text-sm">Spent first, before your packs.</p>
          </CardContent>
          <CardFooter className="text-muted-foreground text-xs tabular-nums">
            {plan.monthlyCredits > 0
              ? `Resets to ${formatNumber(plan.monthlyCredits)} each cycle`
              : "Free plan has no cycle refill"}
          </CardFooter>
        </Card>

        <Card className={cn(isLow && "ring-destructive/30")}>
          <CardHeader>
            <CardTitle className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
              <Package className="size-3.5" aria-hidden />
              Pack credits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p
              className={cn(
                "flex items-center gap-2 text-2xl font-semibold tracking-tight tabular-nums",
                isLow && "text-destructive",
              )}
            >
              <Coins className={cn("size-5", isLow ? "text-destructive" : "text-credit")} aria-hidden />
              {formatNumber(balance.packCredits)}
            </p>
            <p className="text-muted-foreground text-sm">Bought once, kept forever.</p>
          </CardContent>
          <CardFooter className="text-muted-foreground text-xs">Never expire</CardFooter>
        </Card>
      </div>
    </section>
  );
}
