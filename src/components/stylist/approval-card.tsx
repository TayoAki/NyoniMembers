"use client";

import { Coins, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useBalance } from "@/hooks/use-credits";
import type { PendingRequest } from "@/hooks/use-stylist";
import { formatCredits } from "@/lib/format";
import { reportError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { renderCreditCost, type RenderQuality } from "@convex/shared/credits";

type ApprovalCardProps = {
  pending: PendingRequest;
  onRespond: (response: { requestId: string; optionId?: string; text?: string }) => Promise<void>;
  disabled?: boolean;
};

type RenderInput = { outfitIds?: unknown; perOutfit?: unknown; quality?: unknown };

function renderSummary(input: unknown): { outfits: number; perOutfit: number; quality: RenderQuality } | null {
  const args = (input ?? {}) as RenderInput;
  const outfits = Array.isArray(args.outfitIds) ? args.outfitIds.length : 0;
  const perOutfit = typeof args.perOutfit === "number" ? args.perOutfit : 0;
  const quality: RenderQuality = args.quality === "hq" ? "hq" : "standard";
  if (outfits === 0 || perOutfit === 0) return null;
  return { outfits, perOutfit, quality };
}

/**
 * The one place credits get spent from the chat. The cost is computed from the same shared table
 * the server charges with, so the number on the button is the number on the ledger.
 */
export function ApprovalCard({ pending, onRespond, disabled }: ApprovalCardProps) {
  const { balance } = useBalance();
  const [busyOption, setBusyOption] = useState<string | null>(null);
  const summary = pending.toolName === "start_renders" ? renderSummary(pending.input) : null;
  const cost = summary ? renderCreditCost(summary.quality, summary.perOutfit, summary.outfits) : null;
  const images = summary ? summary.outfits * summary.perOutfit : null;
  const affordable = cost === null || balance === undefined || balance.total >= cost;

  const options =
    pending.request.options && pending.request.options.length > 0
      ? pending.request.options
      : ([
          { id: "approve", label: "Approve", style: "primary" as const },
          { id: "cancel", label: "Cancel", style: "danger" as const },
        ] satisfies { id: string; label: string; style?: "danger" | "default" | "primary" }[]);

  async function choose(optionId: string) {
    setBusyOption(optionId);
    try {
      await onRespond({ requestId: pending.requestId, optionId });
    } catch (error) {
      reportError(error, "Could not send that answer.");
    } finally {
      setBusyOption(null);
    }
  }

  const busy = busyOption !== null;

  return (
    <section className="border-credit/40 bg-credit/5 space-y-3 rounded-xl border p-3" aria-label="Approval required">
      <div className="flex items-start gap-2">
        <ShieldCheck className="text-credit mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">Approve this spend</p>
          <p className="text-muted-foreground text-sm text-pretty">{pending.request.prompt}</p>
        </div>
      </div>

      {summary ? (
        <dl className="bg-background/60 grid grid-cols-3 gap-2 rounded-lg border p-2 text-center text-xs">
          <div>
            <dt className="text-muted-foreground">Outfits</dt>
            <dd className="font-medium tabular-nums">{summary.outfits}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Images each</dt>
            <dd className="font-medium tabular-nums">{summary.perOutfit}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Quality</dt>
            <dd className="font-medium">{summary.quality === "hq" ? "HQ" : "Standard"}</dd>
          </div>
        </dl>
      ) : null}

      {cost !== null ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Coins className={cn("size-4", affordable ? "text-credit" : "text-destructive")} aria-hidden />
            <span className="tabular-nums">{formatCredits(cost)}</span>
            {images ? <span className="text-muted-foreground">for {images} images</span> : null}
          </span>
          <span className={cn("text-xs tabular-nums", affordable ? "text-muted-foreground" : "text-destructive")}>
            {balance ? `${formatCredits(balance.total)} left` : "Checking balance…"}
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option.id}
            size="sm"
            variant={option.style === "primary" ? "default" : option.style === "danger" ? "outline" : "outline"}
            disabled={disabled || busy}
            onClick={() => void choose(option.id)}
          >
            {busyOption === option.id ? <Spinner data-icon="inline-start" /> : null}
            {option.label}
          </Button>
        ))}
      </div>
    </section>
  );
}
