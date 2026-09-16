import { PricingTable } from "@clerk/nextjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionBoundary } from "./section-boundary";

/**
 * Clerk Billing owns upgrades, downgrades and cancellations — the table opens Clerk's
 * in-app checkout drawer and the webhook grants the new allowance.
 */
export function PlansCard() {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Plans</CardTitle>
        <CardDescription>
          Plan credits reset at the start of every billing cycle; credits from packs never expire.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-1">
        <SectionBoundary
          title="Plans are unavailable right now"
          message="Plans could not be loaded. Try again in a moment."
        >
          <PricingTable
            fallback={
              <div className="grid gap-4 sm:grid-cols-3" aria-busy="true" aria-label="Loading plans">
                <div className="bg-muted h-56 animate-pulse rounded-xl" />
                <div className="bg-muted h-56 animate-pulse rounded-xl" />
                <div className="bg-muted h-56 animate-pulse rounded-xl" />
              </div>
            }
          />
        </SectionBoundary>
      </CardContent>
    </Card>
  );
}
