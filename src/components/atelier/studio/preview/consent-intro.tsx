"use client";

import type { ReactNode } from "react";
import { Mono } from "@/components/atelier/common/mono";
import { Button } from "@/components/ui/button";
import { CONSENT_VERSION, PHOTO_CONSENT } from "@convex/shared/atelier/policy";

type ConsentIntroProps = {
  /** True when a photograph already exists and a new one will retire it (C11 "Replace"). */
  replacing?: boolean;
  /** A line of status to show above the introduction (a removal receipt, a cancelled job). */
  notice?: ReactNode;
  onAddPhotograph: () => void;
  /** Leaves the step without a photograph; every design choice stays. */
  onContinue: () => void;
  continueLabel?: string;
};

/**
 * S10 (C08): what a personal preview is and is not, who makes it, how long the photograph is kept, and
 * what works as a photograph. Consent is the single explicit action; nothing is read or sent before it.
 */
export function ConsentIntro({
  replacing = false,
  notice,
  onAddPhotograph,
  onContinue,
  continueLabel = "Continue with the studio illustration",
}: ConsentIntroProps) {
  return (
    <div className="space-y-6">
      {notice}
      <div className="space-y-2">
        <h2 className="text-xl font-medium tracking-tight sm:text-2xl">{PHOTO_CONSENT.title}</h2>
        <p className="max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground">{PHOTO_CONSENT.what}</p>
      </div>

      <section aria-labelledby="consent-limits" className="border-t border-foreground/15 pt-5">
        <h3 id="consent-limits" className="text-base font-medium">
          What the preview is, and is not
        </h3>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
          {PHOTO_CONSENT.limits.map((limit) => (
            <li key={limit} className="flex gap-3">
              <span aria-hidden className="mt-2.5 size-1 shrink-0 rounded-full bg-foreground/50" />
              <span className="text-pretty">{limit}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="consent-handling" className="border-t border-foreground/15 pt-5">
        <h3 id="consent-handling" className="text-base font-medium">
          How your photograph is handled
        </h3>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-pretty text-muted-foreground">
          <p>{PHOTO_CONSENT.provider}</p>
          <p>{PHOTO_CONSENT.retention}</p>
          <p>{PHOTO_CONSENT.notUsedFor}</p>
        </div>
      </section>

      <section aria-labelledby="consent-photos" className="border-t border-foreground/15 pt-5">
        <h3 id="consent-photos" className="text-base font-medium">
          The photograph that works
        </h3>
        <div className="mt-3 grid gap-5 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground">Works well</p>
            <ul className="mt-2 space-y-1.5 leading-relaxed">
              {PHOTO_CONSENT.suitable.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground">Does not work</p>
            <ul className="mt-2 space-y-1.5 leading-relaxed text-muted-foreground">
              {PHOTO_CONSENT.unsuitable.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="space-y-4 border-t border-foreground/15 pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button className="min-h-11 rounded-sm px-5" onClick={onAddPhotograph}>
            {replacing ? "Add a new photograph" : "Add a photograph"}
          </Button>
          <Button variant="ghost" className="min-h-11 rounded-sm" onClick={onContinue}>
            {continueLabel}
          </Button>
        </div>
        <p className="text-xs leading-relaxed text-pretty text-muted-foreground">
          Adding a photograph is your agreement to the terms above{" "}
          <Mono upper={false} className="text-[10px]">
            v{CONSENT_VERSION}
          </Mono>
          .{" "}
          {replacing
            ? "When the new photograph is accepted, the current one and every preview made from it are deleted; your design stays."
            : "Skipping this keeps every choice you have made; the studio illustration already shows them."}
        </p>
      </div>
    </div>
  );
}
