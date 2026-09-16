import { Check, Coins } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCredits, formatNumber, formatUsd, formatUsdPrecise, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { PACKS, PACK_IDS, PLANS, PLAN_IDS, type PlanDefinition } from "@convex/shared/credits";
import { FEATURE_LABELS } from "./plan-copy";

const HIGHLIGHTED = "pro";

function planPerks(plan: PlanDefinition): string[] {
  const credits =
    plan.monthlyCredits > 0
      ? `${formatCredits(plan.monthlyCredits)} every cycle`
      : `${formatCredits(plan.signupCredits)} once, on signup`;
  return [
    credits,
    pluralize(plan.maxAvatars, "avatar photo"),
    ...plan.features.map((feature) => FEATURE_LABELS[feature]),
  ];
}

export function PricingSummary() {
  return (
    <section id="pricing" className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="max-w-2xl">
        <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          Pick a plan, top up when you want
        </h2>
        <p className="text-muted-foreground mt-3 text-sm text-pretty sm:text-base">
          Plans refill your credits every billing cycle. Packs are one-off and never expire — buy one when a big
          wardrobe upload lands.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:gap-5 lg:grid-cols-3">
        {PLAN_IDS.map((planId) => {
          const plan = PLANS[planId];
          const highlighted = planId === HIGHLIGHTED;
          return (
            <div
              key={plan.id}
              className={cn(
                "bg-card flex flex-col gap-5 rounded-xl border p-6",
                highlighted && "border-foreground/25 ring-foreground/10 ring-1",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium tracking-tight">{plan.name}</h3>
                  <p className="text-muted-foreground mt-1 text-sm text-pretty">{plan.blurb}</p>
                </div>
                {highlighted ? <Badge className="shrink-0">Most popular</Badge> : null}
              </div>

              <p className="flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold tracking-tight tabular-nums">{formatUsd(plan.priceUsd)}</span>
                <span className="text-muted-foreground text-sm">{plan.priceUsd > 0 ? "/ month" : "forever"}</span>
              </p>

              <ul className="flex flex-1 flex-col gap-2 text-sm">
                {planPerks(plan).map((perk) => (
                  <li key={perk} className="flex items-start gap-2">
                    <Check className="text-success mt-0.5 size-4 shrink-0" aria-hidden />
                    <span className="text-muted-foreground">{perk}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={highlighted ? "default" : "outline"}
                className="w-full"
                render={<Link href={routes.signUp} />}
              >
                {plan.priceUsd > 0 ? `Choose ${plan.name}` : "Start free"}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="bg-muted/30 mt-6 rounded-xl border p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="flex items-center gap-2 font-medium tracking-tight">
            <Coins className="text-credit size-4" aria-hidden />
            Credit packs
          </h3>
          <p className="text-muted-foreground text-sm">One-off, stacked on top of any plan, never expire.</p>
        </div>
        <ul className="mt-5 grid gap-3 sm:grid-cols-3">
          {PACK_IDS.map((packId) => {
            const pack = PACKS[packId];
            return (
              <li
                key={pack.id}
                className="bg-background flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium tabular-nums">{formatNumber(pack.credits)} credits</p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {formatUsdPrecise(pack.priceUsd / pack.credits)} each
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium tabular-nums">{formatUsd(pack.priceUsd)}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
