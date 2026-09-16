"use client";

import { AlertCircle, Check, Cloud, Coins, Shirt, SlidersHorizontal, Sparkles, WandSparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  get_wardrobe: Shirt,
  get_context: SlidersHorizontal,
  get_weather: Cloud,
  compose_outfits: Sparkles,
  quote_renders: Coins,
  start_renders: WandSparkles,
  save_outfit: Check,
};

/** One line of copy per tool so the chat says what it is doing, not which function it called. */
export function toolActivityLabel(toolName: string, input: unknown): string {
  const args = (input ?? {}) as Record<string, unknown>;
  switch (toolName) {
    case "get_wardrobe": {
      const filters = [args.category, args.season].filter((value): value is string => typeof value === "string");
      return filters.length > 0 ? `Reading your wardrobe (${filters.join(", ")})` : "Reading your wardrobe";
    }
    case "get_context":
      return "Checking your preferences";
    case "get_weather":
      return typeof args.place === "string" ? `Checking the weather in ${args.place}` : "Checking the weather";
    case "compose_outfits": {
      const count = Array.isArray(args.outfits) ? args.outfits.length : 0;
      return count > 0 ? `Putting together ${count} ${count === 1 ? "outfit" : "outfits"}` : "Putting outfits together";
    }
    case "quote_renders":
      return "Working out the credit cost";
    case "start_renders":
      return "Starting the renders";
    case "save_outfit":
      return "Saving the outfit";
    case "load_skill":
      return "Looking something up";
    default:
      return toolName.replace(/_/g, " ");
  }
}

type ToolActivityProps = {
  toolName: string;
  input: unknown;
  state: "running" | "done" | "error";
  detail?: string;
};

/** The compact chip shown for tools with no card of their own. */
export function ToolActivity({ toolName, input, state, detail }: ToolActivityProps) {
  const Icon = ICONS[toolName] ?? Sparkles;
  return (
    <div
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1 text-xs",
        state === "error" ? "border-destructive/40 text-destructive" : "border-border/70 text-muted-foreground",
      )}
      role="status"
    >
      {state === "running" ? (
        <Spinner className="size-3.5" />
      ) : state === "error" ? (
        <AlertCircle className="size-3.5 shrink-0" aria-hidden />
      ) : (
        <Icon className="size-3.5 shrink-0" aria-hidden />
      )}
      <span className="truncate">{detail ?? toolActivityLabel(toolName, input)}</span>
    </div>
  );
}
