"use client";

import { Coins } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useBalance } from "@/hooks/use-credits";
import { formatCredits, formatDate, formatNumber } from "@/lib/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { PLANS } from "@convex/shared/credits";

/** Topbar balance. Turns amber when low; click goes to billing. */
export function CreditBadge({ className }: { className?: string }) {
  const { balance, isLow } = useBalance();
  if (!balance) return <Skeleton className={cn("h-7 w-24 rounded-full", className)} />;
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Link href={routes.billing} aria-label={`${formatCredits(balance.total)} available. Open billing.`} />}
      >
        <Badge
          variant={isLow ? "destructive" : "secondary"}
          className={cn("h-7 gap-1.5 rounded-full px-2.5 text-xs tabular-nums", !isLow && "text-foreground", className)}
        >
          <Coins className={cn("size-3.5", isLow ? "" : "text-credit")} aria-hidden />
          {formatNumber(balance.total)}
          <span className="hidden sm:inline">{balance.total === 1 ? "credit" : "credits"}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="space-y-1 text-xs">
        <div className="font-medium">{PLANS[balance.plan].name} plan</div>
        <div className="tabular-nums">Plan credits: {formatNumber(balance.planCredits)}</div>
        <div className="tabular-nums">Pack credits: {formatNumber(balance.packCredits)}</div>
        {balance.planPeriodEnd ? <div>Renews {formatDate(balance.planPeriodEnd)}</div> : null}
        {isLow ? <div className="text-warning">Running low. Top up to keep rendering.</div> : null}
      </TooltipContent>
    </Tooltip>
  );
}
