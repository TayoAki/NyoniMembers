import { Coins, Gauge, Infinity as InfinityIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCredits, formatUsdPrecise, pluralize } from "@/lib/format";
import { CREDIT_COSTS, LIMITS, UNIT_ECONOMICS } from "@convex/shared/credits";

type MeterRow = { action: string; cost: string; note: string; free?: boolean };

const ROWS: readonly MeterRow[] = [
  {
    action: "Detect and tag a photo",
    cost: "Free",
    note: "Reading a photo is a text model, and text is on us.",
    free: true,
  },
  {
    action: "Cut out one garment",
    cost: formatCredits(CREDIT_COSTS.extractItem),
    note: `About ${formatUsdPrecise(CREDIT_COSTS.extractItem * UNIT_ECONOMICS.cogsUsdPerCredit)} of image generation.`,
  },
  {
    action: "Render you in an outfit",
    cost: formatCredits(CREDIT_COSTS.render.standard),
    note: `About ${formatUsdPrecise(CREDIT_COSTS.render.standard * UNIT_ECONOMICS.cogsUsdPerCredit)}, 30–50 seconds.`,
  },
  {
    action: "Render in HQ",
    cost: formatCredits(CREDIT_COSTS.render.hq),
    note: `About ${formatUsdPrecise(CREDIT_COSTS.render.hq * UNIT_ECONOMICS.cogsUsdPerCredit)} at the higher quality setting.`,
  },
];

export function CreditsExplainer() {
  return (
    <section id="credits" className="bg-muted/30 border-y">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
        <div>
          <Badge variant="outline" className="h-6 gap-1.5 rounded-full px-3 text-[0.7rem]">
            <Coins className="text-credit" aria-hidden />
            The meter
          </Badge>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            Credits, not surprises
          </h2>
          <p className="text-muted-foreground mt-3 text-sm text-pretty sm:text-base">
            One credit is one generated image. Nothing else costs anything — browsing, tagging, searching, outfit
            building and talking to the stylist are all free. You see the exact price before you press the button, and
            failed images are refunded automatically.
          </p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="bg-background rounded-xl border p-4">
              <dt className="flex items-center gap-2 text-sm font-medium">
                <InfinityIcon className="text-muted-foreground size-4" aria-hidden />
                Packs never expire
              </dt>
              <dd className="text-muted-foreground mt-1 text-sm">
                Plan credits reset every cycle; anything you top up stays until you spend it.
              </dd>
            </div>
            <div className="bg-background rounded-xl border p-4">
              <dt className="flex items-center gap-2 text-sm font-medium">
                <Gauge className="text-muted-foreground size-4" aria-hidden />A daily ceiling
              </dt>
              <dd className="text-muted-foreground mt-1 text-sm tabular-nums">
                {pluralize(LIMITS.dailyCreditCap, "credit")} a day, so a runaway batch can never drain the balance you
                were saving.
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-background rounded-xl border">
          <div className="flex items-baseline justify-between gap-4 border-b px-5 py-3.5">
            <h3 className="text-sm font-medium">What costs a credit</h3>
            <span className="text-muted-foreground text-xs">Measured, not estimated</span>
          </div>
          <ul className="divide-y">
            {ROWS.map((row) => (
              <li key={row.action} className="flex items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{row.action}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs text-pretty">{row.note}</p>
                </div>
                <span
                  className={
                    row.free
                      ? "text-success shrink-0 text-sm font-medium tabular-nums"
                      : "shrink-0 text-sm font-medium tabular-nums"
                  }
                >
                  {row.cost}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
