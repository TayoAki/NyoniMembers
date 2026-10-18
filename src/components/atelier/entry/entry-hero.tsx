"use client";

import Link from "next/link";
import { ErrorAlert } from "@/components/common/error-alert";
import { DisplayLine } from "@/components/atelier/common/atelier-section";
import { useAtelierSession } from "@/components/atelier/shell/atelier-session";
import { SuitFigure } from "@/components/atelier/studio/suit-figure";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ClientError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { clothSeedByCode } from "@convex/shared/atelier/cloths";
import { LOOKS } from "@convex/shared/atelier/looks";
import { HOUSE_POLICY } from "@convex/shared/atelier/policy";

const FEATURED = LOOKS[0];

type EntryHeroProps = {
  onStart: () => void;
  starting: boolean;
  disabled: boolean;
  error: ClientError | null;
  onRetry: () => void;
};

/**
 * S01, the first viewport. Persuade mode, once: the house's gold-rule eyebrow, one display line, the
 * verified service facts and a single primary action beside the studio look.
 */
export function EntryHero({ onStart, starting, disabled, error, onRetry }: EntryHeroProps) {
  const { draftIndex, storageAvailable, ready } = useAtelierSession();
  const cloth = FEATURED.spec.clothCode ? clothSeedByCode(FEATURED.spec.clothCode) : undefined;
  const latest = draftIndex[0];

  return (
    <section
      aria-labelledby="entry-title"
      className="grid gap-10 pt-8 lg:min-h-[calc(100svh-72px-4rem)] lg:grid-cols-12 lg:items-center lg:gap-12 lg:pt-10"
    >
      <div className="flex flex-col gap-7 lg:col-span-6">
        <p className="flex items-center gap-3 font-mono text-[10px] tracking-[0.16em] text-credit uppercase">
          <span aria-hidden className="h-px w-10 bg-credit" />
          Nyoni Couture · Made to measure
        </p>
        <DisplayLine>Design the suit. The house makes it.</DisplayLine>
        <div className="max-w-xl space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
          <p>
            {HOUSE_POLICY.verified.leadTime} {HOUSE_POLICY.verified.fittings}
          </p>
          <p>{HOUSE_POLICY.verified.alterations}</p>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              className="h-12 rounded-none px-7 text-[15px]"
              onClick={onStart}
              disabled={disabled || starting}
              aria-busy={starting}
            >
              {starting ? <Spinner data-icon="inline-start" aria-label="Starting your design" /> : null}
              {starting ? "Starting your design…" : "Start designing"}
            </Button>
            {ready && latest ? (
              <Link
                href={routes.atelier.drafts}
                className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4 hover:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4"
              >
                Continue a draft
              </Link>
            ) : null}
          </div>
          {error ? (
            <ErrorAlert
              title="Could not start a design"
              message={error.message}
              onRetry={onRetry}
              retryLabel="Try again"
              className="max-w-md"
            />
          ) : null}
          <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
            {ready && !storageAvailable
              ? "This browser is not keeping drafts; you can still design and download your work."
              : "No account, no photograph, no tour. Each is optional, and the studio works without them."}
          </p>
        </div>
      </div>

      <figure className="flex flex-col items-center gap-4 lg:col-span-6">
        <div className="flex h-[52svh] max-h-[640px] w-full items-center justify-center lg:h-[min(72svh,760px)]">
          <SuitFigure
            spec={FEATURED.spec}
            hex={cloth?.hex ?? null}
            pattern={cloth?.pattern}
            className="h-full"
            title={`Studio illustration of the ${FEATURED.properName} look: ${FEATURED.name}`}
          />
        </div>
        <figcaption className="flex flex-col items-center gap-1 text-center">
          <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
            Studio illustration
          </span>
          <span className="text-sm">
            <span className="font-display italic">{FEATURED.properName}</span>
            {cloth ? (
              <>
                {" · "}
                {cloth.name}, {cloth.mill}
              </>
            ) : null}
          </span>
          {cloth ? <span className="text-xs text-muted-foreground">Representative shade</span> : null}
        </figcaption>
      </figure>
    </section>
  );
}
