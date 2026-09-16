"use client";

import { ArrowUpRight, Bookmark } from "lucide-react";
import Link from "next/link";
import { OutfitCollage } from "@/components/common/outfit-collage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useThreadProposals } from "@/hooks/use-stylist";
import { routes } from "@/lib/routes";
import type { Id } from "@convex/_generated/dataModel";

type ProposalCardsProps = {
  threadId: Id<"threads">;
  /** Outfit ids this particular `compose_outfits` call produced. */
  outfitIds: Id<"outfits">[];
  problems: { name: string; problems: string[] }[];
  /**
   * Saving is the agent's job — `agent.saveOutfit` is behind the service key and the public
   * `outfits.*` surface has no "promote a proposal" mutation. So the button asks the stylist to do
   * it, which also keeps the conversation honest about what happened.
   */
  onSave: (name: string) => void;
  canSave: boolean;
};

export function ProposalCards({ threadId, outfitIds, problems, onSave, canSave }: ProposalCardsProps) {
  const proposals = useThreadProposals(threadId);

  if (outfitIds.length === 0 && problems.length === 0) return null;

  if (proposals === undefined && outfitIds.length > 0) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {outfitIds.map((id) => (
          <Skeleton key={id} className="h-44 rounded-xl" />
        ))}
      </div>
    );
  }

  const wanted = new Set<string>(outfitIds);
  const shown = (proposals ?? []).filter((proposal) => wanted.has(proposal.outfit._id));

  return (
    <div className="space-y-3">
      {shown.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {shown.map((proposal) => (
            <article
              key={proposal._id}
              className="bg-card ring-foreground/5 flex flex-col gap-3 rounded-xl border p-3 ring-1"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-medium">{proposal.outfit.name}</h3>
                  {proposal.outfit.occasion ? (
                    <Badge variant="secondary" className="mt-1">
                      {proposal.outfit.occasion}
                    </Badge>
                  ) : null}
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  render={<Link href={routes.outfit(proposal.outfit._id)} />}
                  aria-label={`Open ${proposal.outfit.name}`}
                >
                  <ArrowUpRight />
                </Button>
              </div>

              <OutfitCollage items={proposal.outfit.items} tile="size-14" max={6} />

              {proposal.outfit.reasoning ? (
                <p className="text-muted-foreground text-xs leading-relaxed text-pretty">{proposal.outfit.reasoning}</p>
              ) : null}

              <div className="mt-auto flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={!canSave} onClick={() => onSave(proposal.outfit.name)}>
                  <Bookmark data-icon="inline-start" />
                  Save to outfits
                </Button>
                {proposal.outfit.renderCount > 0 ? (
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {proposal.outfit.renderCount} rendered
                  </span>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {problems.map((problem, index) => (
        <p key={`${problem.name}-${index}`} className="text-muted-foreground text-xs">
          <span className="text-foreground font-medium">{problem.name}</span> could not be saved:{" "}
          {problem.problems.join("; ")}
        </p>
      ))}
    </div>
  );
}
