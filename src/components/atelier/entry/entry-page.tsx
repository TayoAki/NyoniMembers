"use client";

import { EntryHero } from "@/components/atelier/entry/entry-hero";
import { LookList } from "@/components/atelier/entry/look-list";
import { OccasionChooser } from "@/components/atelier/entry/occasion-chooser";
import { useStartDraft } from "@/components/atelier/entry/use-start-draft";
import { OCCASIONS, type Occasion } from "@convex/shared/atelier/enums";

const START_KEY = "start";

function isOccasion(value: string | null): value is Occasion {
  return value !== null && (OCCASIONS as readonly string[]).includes(value);
}

/** S01 + S02: everything renders for a guest; every start control shares one creation at a time. */
export function EntryPage() {
  const { start, pending, error, canStart, clearError } = useStartDraft();
  const pendingOccasion = isOccasion(pending) ? pending : null;
  const pendingLook = pending && pending !== START_KEY && !pendingOccasion ? pending : null;

  return (
    <div className="space-y-14 pb-6">
      <EntryHero
        onStart={() => void start({}, START_KEY)}
        starting={pending === START_KEY}
        disabled={!canStart || (pending !== null && pending !== START_KEY)}
        error={error}
        onRetry={() => {
          clearError();
          void start({}, START_KEY);
        }}
      />
      <LookList onStart={(lookKey) => void start({ lookKey }, lookKey)} pendingKey={pendingLook} disabled={!canStart} />
      <OccasionChooser
        onChoose={(occasion) => void start({ occasion }, occasion)}
        pendingOccasion={pendingOccasion}
        disabled={!canStart}
      />
    </div>
  );
}
