"use client";

import { useQuery } from "convex/react";
import type { ReactNode } from "react";
import { api } from "@convex/_generated/api";
import type { ParticipationView } from "@convex/atelier/groups";
import { STEP_LABELS } from "@convex/shared/atelier/enums";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { permittedLabel } from "@/components/atelier/groups/group-words";
import { useStudio } from "./panel-contract";
import { SaveStatus } from "./save-status";
import { Stage } from "./stage";
import { StepRail } from "./step-rail";

/**
 * On phones the stage is a sticky header that gives the panel room as it scrolls: a scroll-driven
 * animation where the browser has one, a fixed height where it does not, and no motion under a
 * reduced-motion preference. CSS only; the page's scrolling is never intercepted.
 */
const STAGE_CSS = `
@keyframes atelier-stage-shrink { from { height: 40svh; } to { height: 22svh; } }
@media (max-width: 1023.98px) {
  .atelier-stage { height: 34svh; }
  @supports (animation-timeline: scroll()) {
    @media (prefers-reduced-motion: no-preference) {
      .atelier-stage {
        height: 40svh;
        animation: atelier-stage-shrink linear both;
        animation-timeline: scroll(root);
        animation-range: 0 260px;
      }
    }
  }
}
`;

const STATE_NOTE: Partial<Record<string, string>> = {
  submitted:
    "This design has been sent to the house. To change it, reply on your request or start a new design from it.",
  archived: "This design has been archived. Duplicate it to work on it again.",
};

/** "Vents, Lining and Monogram": the permitted lines as the organizer's screen names them. */
function listWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/**
 * C28: a design made from a group's brief says so where the client works on it, and names the lines
 * that are theirs to choose, so a line the server refuses is a line this sentence already placed with
 * the organizer. The group's words come from the participation view, never from here.
 */
function GroupBriefLine({ participation }: { participation: ParticipationView }) {
  const yours = participation.permittedIndividual.map(permittedLabel);
  return (
    <p className="text-sm text-pretty text-muted-foreground">
      Part of <span className="text-foreground">{participation.groupName}</span>, {participation.organizerFirstName}
      ’s shared design.{" "}
      {yours.length > 0
        ? `Yours to choose: ${listWords(yours)}. What the shared design sets beyond these cannot be changed here.`
        : "What the shared design sets cannot be changed here."}
    </p>
  );
}

/**
 * The studio's two columns: the stage (7/12, sticky) beside a panel that reads like an order book
 * (5/12). Stacked on phones with the stage as a collapsing sticky header above the rail and the panel;
 * the panel keeps its own primary actions, never under a fixed bar (S&S contract).
 */
export function StudioFrame({ children }: { children: ReactNode }) {
  const { draft, step, ownerArgs } = useStudio();
  const note = STATE_NOTE[draft.status];
  const participation = useQuery(
    api.atelier.groups.myParticipation,
    draft.groupId ? { ...ownerArgs, draftId: draft._id } : "skip",
  );
  return (
    <div className="lg:grid lg:grid-cols-12 lg:gap-x-10 xl:gap-x-14">
      <style href="atelier-studio-stage" precedence="default">
        {STAGE_CSS}
      </style>
      <div className="atelier-stage sticky top-16 z-20 -mx-4 bg-background px-4 pt-3 pb-2 sm:top-[72px] sm:-mx-8 sm:px-8 lg:sticky lg:top-24 lg:col-span-7 lg:mx-0 lg:h-[calc(100svh-7.5rem)] lg:self-start lg:px-0 lg:pt-8 lg:pb-0">
        <Stage />
      </div>
      <div className="min-w-0 pt-4 pb-6 lg:col-span-5 lg:pt-8">
        <StepRail />
        <header className="space-y-2 border-b border-foreground/15 py-5">
          <p className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{draft.name}</span>
            <Mono className="shrink-0">Revision {draft.revision}</Mono>
          </p>
          <h1 className="font-display text-[28px] leading-[1.05] font-medium tracking-[-0.01em] text-balance sm:text-[32px]">
            {STEP_LABELS[step]}
          </h1>
          <SaveStatus />
          {participation && participation.status !== "declined" ? (
            <GroupBriefLine participation={participation} />
          ) : null}
          {note ? (
            <StatusLine tone="warning" className="text-pretty">
              {note}
            </StatusLine>
          ) : null}
        </header>
        <div className="pt-6">{children}</div>
      </div>
    </div>
  );
}
