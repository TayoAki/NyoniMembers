"use client";

import { Check, Sparkles, UserRound, Wand2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { CreditQuote } from "@/components/common/credit-quote";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorAlert } from "@/components/common/error-alert";
import { ItemImage } from "@/components/common/item-image";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCreditQuote } from "@/hooks/use-credits";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAvatars, useRenderActions } from "@/hooks/use-renders";
import { formatCredits, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { Id } from "@convex/_generated/dataModel";
import { LIMITS, renderCreditCost, type RenderQuality } from "@convex/shared/credits";

type RenderSheetProps = {
  outfitId: Id<"outfits">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStarted: (jobId: Id<"jobs">) => void;
};

const COUNTS = Array.from({ length: LIMITS.maxRendersPerRequest }, (_, index) => index + 1);

/** Avatar, how many, what quality, what it costs — then start the render job. */
export function RenderSheet({ outfitId, open, onOpenChange, onStarted }: RenderSheetProps) {
  const isMobile = useIsMobile();
  const avatars = useAvatars();
  const { user } = useCurrentUser();
  const actions = useRenderActions();

  const [chosenAvatarId, setChosenAvatarId] = useState<Id<"avatars"> | null>(null);
  const [count, setCount] = useState(1);
  const [quality, setQuality] = useState<RenderQuality>("standard");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The default avatar is preselected without an effect: it is simply the fallback until one is picked.
  const defaultAvatarId = (avatars?.find((avatar) => avatar.isDefault) ?? avatars?.[0])?._id ?? null;
  const avatarId = chosenAvatarId ?? defaultAvatarId;

  const hqUnlocked = user?.balance.features.includes("hq_renders") ?? false;
  const effectiveQuality: RenderQuality = hqUnlocked ? quality : "standard";
  const quote = useCreditQuote(open ? { kind: "render", quality: effectiveQuality, count } : null);
  const credits = renderCreditCost(effectiveQuality, count);

  async function handleStart() {
    if (!avatarId || pending) return;
    setPending(true);
    setError(null);
    const result = await actions.start(
      { outfitIds: [outfitId], avatarId, count, quality: effectiveQuality },
      (clientError) => setError(clientError.message),
    );
    setPending(false);
    if (!result) return;
    toast.success(`Rendering ${pluralize(count, "image")}. This usually takes under a minute.`);
    onOpenChange(false);
    onStarted(result.jobId);
  }

  const noAvatars = avatars !== undefined && avatars.length === 0;
  const canStart = Boolean(avatarId) && !pending && (quote?.canAfford ?? false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className="flex flex-col gap-0 p-0 data-[side=bottom]:max-h-[90dvh] data-[side=bottom]:rounded-t-2xl data-[side=right]:sm:max-w-md"
      >
        <SheetHeader className="border-b">
          <SheetTitle>Render on me</SheetTitle>
          <SheetDescription>Pick a photo of yourself and how many looks you want back.</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
          {noAvatars ? (
            <EmptyState
              icon={UserRound}
              className="min-h-[180px]"
              title="No photo of you yet"
              description="Add a full-length photo in settings and Fitcheck can dress it in your clothes."
              action={<Button render={<Link href={routes.settings} />}>Add a photo</Button>}
            />
          ) : (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">You</legend>
              <div className="flex flex-wrap gap-2 pt-1">
                {avatars === undefined
                  ? Array.from({ length: 2 }, (_, index) => <Skeleton key={index} className="size-20 rounded-lg" />)
                  : avatars.map((avatar) => {
                      const selected = avatar._id === avatarId;
                      return (
                        <button
                          key={avatar._id}
                          type="button"
                          onClick={() => setChosenAvatarId(avatar._id)}
                          aria-pressed={selected}
                          className={cn(
                            "focus-visible:ring-ring relative rounded-lg p-0.5 transition-all focus-visible:ring-2 focus-visible:outline-none",
                            selected ? "ring-primary ring-2" : "hover:ring-border ring-1 ring-transparent",
                          )}
                        >
                          <ItemImage
                            src={avatar.url}
                            alt={avatar.label}
                            variant="photo"
                            aspect="aspect-square"
                            className="size-20 rounded-md"
                          />
                          {selected ? (
                            <span className="bg-primary text-primary-foreground absolute top-1 right-1 flex size-5 items-center justify-center rounded-full">
                              <Check className="size-3" aria-hidden />
                            </span>
                          ) : null}
                          <span className="sr-only">{avatar.label}</span>
                        </button>
                      );
                    })}
              </div>
            </fieldset>
          )}

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">How many</legend>
            <ToggleGroup
              value={[String(count)]}
              onValueChange={(value) => {
                const next = Number(value[0]);
                if (Number.isFinite(next) && next >= 1) setCount(next);
              }}
              variant="outline"
              spacing={0}
              className="pt-1"
              aria-label="Number of images"
            >
              {COUNTS.map((option) => (
                <ToggleGroupItem key={option} value={String(option)} className="min-w-12 tabular-nums">
                  {option}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Quality</legend>
            <ToggleGroup
              value={[effectiveQuality]}
              onValueChange={(value) => {
                const next = value[0];
                if (next === "standard") setQuality("standard");
                if (next === "hq" && hqUnlocked) setQuality("hq");
              }}
              variant="outline"
              spacing={0}
              className="pt-1"
              aria-label="Render quality"
            >
              <ToggleGroupItem value="standard">Standard</ToggleGroupItem>
              {hqUnlocked ? (
                <ToggleGroupItem value="hq">
                  <Sparkles data-icon="inline-start" />
                  HQ
                </ToggleGroupItem>
              ) : (
                // `aria-disabled` rather than `disabled` so the "Plus plan" tooltip still reaches
                // hover and keyboard focus; the controlled `onValueChange` above ignores the click.
                <Tooltip>
                  <TooltipTrigger
                    render={<ToggleGroupItem value="hq" aria-disabled className="cursor-not-allowed opacity-50" />}
                  >
                    <Sparkles data-icon="inline-start" />
                    HQ
                  </TooltipTrigger>
                  <TooltipContent>Plus plan</TooltipContent>
                </Tooltip>
              )}
            </ToggleGroup>
            <p className="text-muted-foreground text-xs">
              Standard costs {formatCredits(renderCreditCost("standard", 1))} an image, HQ{" "}
              {formatCredits(renderCreditCost("hq", 1))}.
            </p>
          </fieldset>

          <CreditQuote quote={quote} label={pluralize(count, "image")} />

          {error ? <ErrorAlert title="Could not start rendering" message={error} /> : null}
        </div>

        <SheetFooter className="flex-col gap-2 border-t">
          <Button className="w-full" disabled={!canStart} onClick={() => void handleStart()}>
            {pending ? <Spinner data-icon="inline-start" /> : <Wand2 data-icon="inline-start" />}
            Render {pluralize(count, "image")} · {formatCredits(credits)}
          </Button>
          {quote && !quote.canAfford ? (
            <Button variant="outline" className="w-full" render={<Link href={routes.billing} />}>
              Top up credits
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
