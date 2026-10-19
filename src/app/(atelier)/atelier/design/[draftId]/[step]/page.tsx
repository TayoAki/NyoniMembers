import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isStudioStep, STEP_LABELS } from "@convex/shared/atelier/enums";
import { StepPanel } from "@/components/atelier/studio/step-panel";

type StepParams = Promise<{ draftId: string; step: string }>;

export async function generateMetadata({ params }: { params: StepParams }): Promise<Metadata> {
  const { step } = await params;
  return { title: isStudioStep(step) ? STEP_LABELS[step] : "Design studio" };
}

/** Swaps the panel for one of the seven steps; anything else is not a step. */
export default async function StepPage({ params }: { params: StepParams }) {
  const { step } = await params;
  if (!isStudioStep(step)) notFound();
  return <StepPanel step={step} />;
}
