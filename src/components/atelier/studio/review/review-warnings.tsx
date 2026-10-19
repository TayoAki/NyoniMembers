"use client";

import type { DraftWarning } from "@convex/atelier/views";
import type { StudioStep } from "@convex/shared/atelier/enums";
import { StatusLine } from "@/components/atelier/common/status-line";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type WarningCode = DraftWarning["code"];

/** The short name over each warning; the sentence itself comes from the server. */
const WARNING_TITLES: Record<WarningCode, string> = {
  cloth_withdrawn: "Cloth no longer offered",
  cloth_out_of_stock: "Cloth not in stock",
  catalogue_changed: "The catalogue has changed",
  event_tight: "Your date is close",
  event_unlikely: "Your date is inside the making time",
  preview_stale: "Preview shows a previous design",
};

const WARNING_ACTIONS: Record<WarningCode, { label: string; step: StudioStep }> = {
  cloth_withdrawn: { label: "Choose another cloth", step: "cloth" },
  cloth_out_of_stock: { label: "Look at other cloths", step: "cloth" },
  catalogue_changed: { label: "Look over the cloth", step: "cloth" },
  event_tight: { label: "Change the date", step: "occasion" },
  event_unlikely: { label: "Change the date", step: "occasion" },
  preview_stale: { label: "Update the preview", step: "preview" },
};

/** Warnings the client must act on rather than acknowledge: the house will refuse the request otherwise. */
export const BLOCKING_WARNINGS: readonly WarningCode[] = ["cloth_withdrawn"];

/** One acknowledgement per warning sentence: a new sentence under the same code asks again. */
export function warningKey(warning: DraftWarning): string {
  return `${warning.code}:${warning.message}`;
}

export type Blocker = { message: string; step: StudioStep; actionLabel: string };

/** `validateSpec` sentences mapped to the step that settles them. */
export function blockerForError(message: string): Blocker {
  const lower = message.toLowerCase();
  if (lower.startsWith("choose a cloth")) return { message, step: "cloth", actionLabel: "Choose a cloth" };
  if (lower.includes("monogram")) return { message, step: "details", actionLabel: "Fix the monogram" };
  return { message, step: "style", actionLabel: "Open the style step" };
}

/**
 * What stops the design being sent at all (S24, C19): a missing cloth, an invalid combination, a
 * withdrawn cloth. Each names the step that settles it; nothing here can be ticked away.
 */
export function ReviewBlockers({
  blockers,
  onGoToStep,
  className,
}: {
  blockers: Blocker[];
  onGoToStep: (step: StudioStep) => void;
  className?: string;
}) {
  if (blockers.length === 0) return null;
  return (
    <section aria-labelledby="review-blockers-title" className={cn("border-l-2 border-warning pl-4", className)}>
      <h3 id="review-blockers-title" className="text-sm font-medium">
        Before this design can be sent
      </h3>
      <ul className="mt-2 divide-y divide-foreground/10">
        {blockers.map((blocker) => (
          <li key={blocker.message} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
            <StatusLine tone="warning">{blocker.message}</StatusLine>
            <Button
              variant="ghost"
              className="h-11 rounded-none px-2 text-sm underline underline-offset-4"
              onClick={() => onGoToStep(blocker.step)}
            >
              {blocker.actionLabel}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Warnings the house wants read before a request (C19): each is shown with the step that would change
 * it and a checkbox that records the client has read it. Unticked warnings hold the request.
 */
export function ReviewWarnings({
  warnings,
  acknowledged,
  onAcknowledge,
  onGoToStep,
  disabled = false,
  className,
}: {
  warnings: DraftWarning[];
  acknowledged: ReadonlySet<string>;
  onAcknowledge: (key: string, read: boolean) => void;
  onGoToStep: (step: StudioStep) => void;
  disabled?: boolean;
  className?: string;
}) {
  if (warnings.length === 0) return null;
  return (
    <section aria-labelledby="review-warnings-title" className={cn("border-l-2 border-warning pl-4", className)}>
      <h3 id="review-warnings-title" className="text-sm font-medium">
        Read before you send
      </h3>
      <ul className="mt-2 divide-y divide-foreground/10">
        {warnings.map((warning) => {
          const key = warningKey(warning);
          const action = WARNING_ACTIONS[warning.code];
          const read = acknowledged.has(key);
          return (
            <li key={key} className="space-y-2 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <StatusLine tone="warning">{WARNING_TITLES[warning.code]}</StatusLine>
                <Button
                  variant="ghost"
                  className="h-11 rounded-none px-2 text-sm underline underline-offset-4"
                  onClick={() => onGoToStep(action.step)}
                >
                  {action.label}
                </Button>
              </div>
              <p className="text-sm leading-relaxed text-pretty text-muted-foreground">{warning.message}</p>
              <FieldLabel className="flex min-h-11 w-full cursor-pointer items-center gap-3 font-normal">
                <Checkbox
                  checked={read}
                  onCheckedChange={(checked) => onAcknowledge(key, checked === true)}
                  disabled={disabled}
                />
                <span className="text-sm">I have read this and want to send the design as it is</span>
              </FieldLabel>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
