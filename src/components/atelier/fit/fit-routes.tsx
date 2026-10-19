"use client";

import { Mail, MessageSquare } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ROUTE_BRING, ROUTE_SUMMARIES } from "@/components/atelier/fit/fit-words";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { FIT_ROUTE_LABELS, type FitRoute } from "@convex/shared/atelier/enums";
import { HOUSE_POLICY } from "@convex/shared/atelier/policy";
import { HOUSE, SHOWROOMS } from "@convex/shared/house";

/**
 * S19 as service information (C15): the three fit routes, what happens on each, what to bring and
 * where the showrooms are. Choosing a route for a design happens in the studio's Fit step; this page
 * explains and leads to a fitting request or the guided sheet.
 */
export function FitRoutes({ onMeasure }: { onMeasure: () => void }) {
  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm leading-relaxed text-pretty text-muted-foreground">
        Three ways to the same result: a fit profile a fitter has approved. Nothing is measured from a photograph. A
        personal preview in the studio is an illustration of cloth and cut; it never implies your measurements, and
        changing route never touches a design or an earlier profile.
      </p>

      <ol className="divide-y divide-foreground/10 border-y border-foreground/15">
        <RouteItem
          route="atelier"
          happens={HOUSE_POLICY.verified.fittings}
          action={
            <Button
              className="h-11 rounded-none px-5"
              render={<Link href={routes.atelier.fittings} />}
              nativeButton={false}
            >
              Request a fitting
            </Button>
          }
        >
          <ul className="divide-y divide-foreground/10 border-y border-foreground/10 text-sm" aria-label="Showrooms">
            {SHOWROOMS.map((showroom) => (
              <li key={showroom.id} className="grid gap-1 py-3 sm:grid-cols-[6rem_1fr_auto] sm:items-baseline sm:gap-4">
                <span className="font-medium">{showroom.city}</span>
                <span className="text-muted-foreground">{showroom.address}</span>
                <a
                  href={`tel:${showroom.tel}`}
                  className="font-mono text-[11px] tracking-[0.12em] underline-offset-4 hover:underline"
                >
                  {showroom.phone}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">{HOUSE.hours}</p>
        </RouteItem>

        <RouteItem
          route="remote"
          happens="You follow the guide with a tape measure, in centimetres or inches. Every value is reviewed by a fitter, who approves the profile or asks you a question first. Uncertain values can be marked as such rather than guessed."
          action={
            <Button variant="outline" className="h-11 rounded-none px-5" onClick={onMeasure}>
              Measure at home
            </Button>
          }
        />

        <RouteItem
          route="undecided"
          happens="Tell the house where you are and when you need the suit. A concierge will say honestly which route fits, and nothing is measured until you choose."
          action={
            <>
              <Button
                variant="outline"
                className="h-11 rounded-none px-5"
                nativeButton={false}
                render={<a href={`mailto:${HOUSE.concierge.email}`} />}
              >
                <Mail data-icon="inline-start" aria-hidden />
                Email the house
              </Button>
              <Button
                variant="ghost"
                className="h-11 rounded-none px-4"
                nativeButton={false}
                render={<a href={`sms:${HOUSE.concierge.sms}`} />}
              >
                <MessageSquare data-icon="inline-start" aria-hidden />
                Text {HOUSE.concierge.smsDisplay}
              </Button>
            </>
          }
        />
      </ol>

      <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
        {HOUSE_POLICY.verified.leadTime} {HOUSE_POLICY.verified.alterations}
      </p>
    </div>
  );
}

function RouteItem({
  route,
  happens,
  action,
  children,
}: {
  route: FitRoute;
  happens: string;
  action: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="grid gap-5 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto] lg:gap-10">
      <div className="space-y-1.5">
        <h2 className="text-lg font-medium tracking-tight">{FIT_ROUTE_LABELS[route]}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{ROUTE_SUMMARIES[route]}</p>
      </div>
      <div className="space-y-4 text-sm">
        <dl className="space-y-4">
          <div className="space-y-1">
            <dt className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">What happens</dt>
            <dd className="leading-relaxed text-pretty">{happens}</dd>
          </div>
          <div className="space-y-1">
            <dt className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              What to have ready
            </dt>
            <dd className="leading-relaxed text-pretty">{ROUTE_BRING[route]}</dd>
          </div>
        </dl>
        {children ? <div className="pt-1">{children}</div> : null}
      </div>
      <div className="flex flex-wrap items-start gap-2 lg:justify-end">{action}</div>
    </li>
  );
}
