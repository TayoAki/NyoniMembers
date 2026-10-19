"use client";

import { Component, Suspense, lazy, type ErrorInfo, type LazyExoticComponent, type ReactNode } from "react";
import { STEP_LABELS, STUDIO_STEPS, type StudioStep } from "@convex/shared/atelier/enums";
import { ErrorAlert } from "@/components/common/error-alert";
import { toClientError } from "@/lib/errors";
import { STEP_PANEL_MODULES, useStudio, type StepPanelComponent } from "./panel-contract";
import { StepPanelSkeleton } from "./studio-skeleton";

const STUDIO_PREFIX = "@/components/atelier/studio/";

/**
 * Finds a step's panel where `STEP_PANEL_MODULES` says it lives. The specifier is a template, so the
 * bundler resolves it at request time against this folder instead of failing the build while a
 * sibling cluster is still writing its module; a missing panel rejects here and becomes the placeholder.
 */
async function loadPanel(step: StudioStep): Promise<StepPanelComponent | null> {
  const { module: modulePath, exportName } = STEP_PANEL_MODULES[step];
  if (!modulePath.startsWith(STUDIO_PREFIX)) return null;
  const relative = modulePath.slice(STUDIO_PREFIX.length);
  try {
    const loaded: unknown = await import(`./${relative}`);
    const candidate = (loaded as Record<string, unknown>)[exportName];
    return typeof candidate === "function" ? (candidate as StepPanelComponent) : null;
  } catch {
    return null;
  }
}

function PanelPlaceholder() {
  const { step } = useStudio();
  return (
    <div className="border-y border-foreground/15 py-8">
      <p className="text-sm font-medium">This step is being prepared.</p>
      <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
        {STEP_LABELS[step]} is not open in the studio yet. Your design keeps every choice; continue with another step.
      </p>
    </div>
  );
}

const PANELS: Record<StudioStep, LazyExoticComponent<StepPanelComponent>> = Object.fromEntries(
  STUDIO_STEPS.map((step) => [step, lazy(async () => ({ default: (await loadPanel(step)) ?? PanelPlaceholder }))]),
) as Record<StudioStep, LazyExoticComponent<StepPanelComponent>>;

type BoundaryProps = { step: StudioStep; children: ReactNode };
type BoundaryState = { error: unknown | null };

/** A panel that throws must not take the stage, the rail or the save state down with it. */
class PanelBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(`Studio panel "${this.props.step}" failed`, error, info.componentStack);
  }

  render() {
    if (this.state.error !== null) {
      return (
        <ErrorAlert
          title={`${STEP_LABELS[this.props.step]} hit a problem`}
          message={`${toClientError(this.state.error).message} Your design is unchanged; the other steps still work.`}
          onRetry={() => this.setState({ error: null })}
          className="rounded-sm"
        />
      );
    }
    return this.props.children;
  }
}

/**
 * Renders the panel for the current step (or the one given) through the panel contract. Every panel
 * reads the studio with `useStudio()` and takes no props.
 */
export function StepPanel({ step: stepProp }: { step?: StudioStep }) {
  const { step: contextStep } = useStudio();
  const step = stepProp ?? contextStep;
  const Panel = PANELS[step];
  return (
    <PanelBoundary key={step} step={step}>
      <Suspense fallback={<StepPanelSkeleton />}>
        <Panel />
      </Suspense>
    </PanelBoundary>
  );
}
