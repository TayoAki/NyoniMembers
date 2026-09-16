"use client";

import { Coins } from "lucide-react";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { usePackCheckout } from "@/hooks/use-billing";
import { formatNumber, formatUsd, formatUsdPrecise } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PACKS, PACK_IDS, type PackId } from "@convex/shared/credits";
import { CheckoutResult } from "./checkout-result";

/** The pack with the lowest price per credit gets the "best value" flag, computed, not hard-coded. */
const BEST_VALUE: PackId = PACK_IDS.reduce((best, id) =>
  PACKS[id].priceUsd / PACKS[id].credits < PACKS[best].priceUsd / PACKS[best].credits ? id : best,
);

export function CreditPacks() {
  const { buy, pendingPackId } = usePackCheckout();

  return (
    <section id="packs" className="space-y-4" aria-label="Credit packs">
      <Suspense fallback={null}>
        <CheckoutResult />
      </Suspense>

      <div className="space-y-1">
        <h2 className="text-lg font-medium tracking-tight">Credit packs</h2>
        <p className="text-muted-foreground text-sm">
          One-off top-ups on any plan. They stack with your plan credits and never expire.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {PACK_IDS.map((packId) => {
          const pack = PACKS[packId];
          const isBestValue = packId === BEST_VALUE;
          const isPending = pendingPackId === packId;
          return (
            <Card key={pack.id} className={cn(isBestValue && "ring-foreground/25")}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  {pack.name}
                  {isBestValue ? (
                    <Badge variant="secondary" className="shrink-0">
                      Best value
                    </Badge>
                  ) : null}
                </CardTitle>
                <CardDescription className="tabular-nums">
                  {formatUsdPrecise(pack.priceUsd / pack.credits)} per credit
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="flex items-center gap-2 text-2xl font-semibold tracking-tight tabular-nums">
                  <Coins className="text-credit size-5" aria-hidden />
                  {formatNumber(pack.credits)}
                  <span className="text-muted-foreground text-sm font-normal">credits</span>
                </p>
                <Button
                  className="w-full"
                  disabled={pendingPackId !== null}
                  onClick={() => void buy(pack.id)}
                  aria-label={`Buy ${pack.name} — ${formatNumber(pack.credits)} credits for ${formatUsd(pack.priceUsd)}`}
                >
                  {isPending ? <Spinner data-icon="inline-start" /> : null}
                  {isPending ? "Opening checkout…" : `Buy for ${formatUsd(pack.priceUsd)}`}
                </Button>
              </CardContent>
              <CardFooter className="text-muted-foreground text-xs">Never expires · secure Stripe checkout</CardFooter>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
