"use client";

import { createContext, useContext, type ComponentType } from "react";
import type { Id } from "@convex/_generated/dataModel";
import type { DraftView } from "@convex/atelier/drafts";
import type { CatalogueEntryView } from "@convex/atelier/views";
import type { StudioStep } from "@convex/shared/atelier/enums";
import type { ApplyResult, Conflict, SpecPatch, SuitSpec } from "@convex/shared/atelier/spec";

/**
 * The contract between the studio core (provider, frame, stage, step rail) and the step panels.
 * Panels read everything from `useStudio()` and change the design only through `editor`, so the
 * conflict flow (S08), saving and the stage stay in one place. The core implements this; panels
 * never import the core's internals.
 */

export type SaveScope = "browser" | "account";

export type SaveStatus =
  | { state: "idle"; scope: SaveScope; at: number | null }
  | { state: "saving"; scope: SaveScope; at: number | null }
  | { state: "saved"; scope: SaveScope; at: number }
  | { state: "error"; scope: SaveScope; at: number | null; message: string };

export type CommitOutcome =
  | { status: "committed"; conflicts: Conflict[]; spec: SuitSpec }
  | { status: "cancelled"; conflicts: Conflict[] }
  | { status: "failed"; message: string; code: string };

export type StudioCatalogue = {
  cloths: CatalogueEntryView[];
  buttons: CatalogueEntryView[];
  linings: CatalogueEntryView[];
};

export type StageMode = "studio" | "personal" | "swatch";
export type StageView = "front" | "back";

export type SpecEditor = {
  /** The committed design, as the server holds it. */
  spec: SuitSpec;
  /** The design the stage is showing: the committed spec, or a pending preview while a sheet is open. */
  shown: SuitSpec;
  /** Pure: what this change would do, including the dependency engine's conflicts. Writes nothing. */
  preview: (patch: SpecPatch) => ApplyResult;
  /** Show a change on the stage without committing it (a detail sheet being considered); null clears it. */
  stage: (patch: SpecPatch | null) => void;
  /**
   * Apply a change. When the engine reports conflicts the core asks the client to confirm them first;
   * resolves "cancelled" when they keep their design. Never throws: failures come back as "failed".
   */
  commit: (patch: SpecPatch) => Promise<CommitOutcome>;
  saving: SaveStatus;
};

export type StudioContextValue = {
  draftId: Id<"atelierDrafts">;
  draft: DraftView;
  /** Pass to mutations that take a guest key; empty for a signed-in client. */
  guestKeyArg: { guestKey?: string };
  /** Pass to owned reads; the provider only renders with a loaded draft, so this is never "skip". */
  ownerArgs: { guestKey?: string };
  /** undefined while the catalogue is loading. */
  catalogue: StudioCatalogue | undefined;
  editor: SpecEditor;
  step: StudioStep;
  goToStep: (step: StudioStep) => void;
  stage: {
    mode: StageMode;
    setMode: (mode: StageMode) => void;
    view: StageView;
    setView: (view: StageView) => void;
  };
};

export const StudioContext = createContext<StudioContextValue | null>(null);

export function useStudio(): StudioContextValue {
  const context = useContext(StudioContext);
  if (!context) throw new Error("useStudio must be used inside the studio provider.");
  return context;
}

/** Every step panel is a client component taking no props: it reads the studio through useStudio(). */
export type StepPanelComponent = ComponentType<Record<string, never>>;

/**
 * Where the core's dispatcher finds each step's panel. The panel clusters export these names from
 * these modules; the dispatcher imports them lazily and shows a quiet placeholder while a module is
 * still being built.
 */
export const STEP_PANEL_MODULES: Record<StudioStep, { module: string; exportName: string }> = {
  occasion: { module: "@/components/atelier/studio/occasion-panel", exportName: "OccasionPanel" },
  cloth: { module: "@/components/atelier/studio/cloth/cloth-panel", exportName: "ClothPanel" },
  style: { module: "@/components/atelier/studio/style/style-panel", exportName: "StylePanel" },
  details: { module: "@/components/atelier/studio/details/details-panel", exportName: "DetailsPanel" },
  preview: { module: "@/components/atelier/studio/preview/preview-panel", exportName: "PreviewPanel" },
  fit: { module: "@/components/atelier/studio/fit-panel", exportName: "FitPanel" },
  review: { module: "@/components/atelier/studio/review/review-panel", exportName: "ReviewPanel" },
};
