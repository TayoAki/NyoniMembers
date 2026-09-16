"use client";

import { useState } from "react";
import { PageHeader } from "@/components/common/page-header";
import { useCurrentUser } from "@/hooks/use-current-user";
import { cn } from "@/lib/utils";
import { AvatarStep } from "./avatar-step";
import { OnboardingSkeleton } from "./onboarding-skeleton";
import { PreferencesStep } from "./preferences-step";

const STEPS = [
  {
    title: "Add a photo of yourself",
    description: "Renders dress this person in your clothes. You can add more later in settings.",
  },
  {
    title: "Tell us how you dress",
    description: "A few preferences so the stylist starts somewhere sensible. All of it is editable later.",
  },
] as const;

/** Two steps, no skipping: a photo to render on, then the preferences the stylist needs. */
export function OnboardingFlow() {
  const { user, isLoading } = useCurrentUser();
  const [step, setStep] = useState<0 | 1>(0);

  if (isLoading || !user) return <OnboardingSkeleton />;

  const current = STEPS[step];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <div className="space-y-4">
        <PageHeader
          eyebrow={`Step ${step + 1} of ${STEPS.length}`}
          title={current.title}
          description={current.description}
        />
        <ol className="flex gap-2" aria-label="Setup progress">
          {STEPS.map((entry, index) => (
            <li key={entry.title} className="flex-1">
              <span
                className={cn("block h-1 rounded-full transition-colors", index <= step ? "bg-primary" : "bg-muted")}
                aria-current={index === step ? "step" : undefined}
              />
              <span className="sr-only">{entry.title}</span>
            </li>
          ))}
        </ol>
      </div>

      {step === 0 ? (
        <AvatarStep plan={user.balance.plan} onContinue={() => setStep(1)} />
      ) : (
        <PreferencesStep prefs={user.prefs} onBack={() => setStep(0)} />
      )}
    </div>
  );
}
