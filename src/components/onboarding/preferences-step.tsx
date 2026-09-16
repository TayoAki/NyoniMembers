"use client";

import { useMutation } from "convex/react";
import { ArrowLeft, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { ErrorAlert } from "@/components/common/error-alert";
import { ChipsInput } from "@/components/wardrobe/chips-input";
import { SingleToggleGroup } from "@/components/wardrobe/toggle-options";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { CurrentUser } from "@/hooks/use-current-user";
import { reportError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import { FITS, PRESENTATIONS, type Fit, type Presentation } from "@convex/shared/wardrobe";

const PRESENTATION_HINTS: Record<Presentation, string> = {
  masculine: "Menswear silhouettes",
  feminine: "Womenswear silhouettes",
  neutral: "No assumption either way",
};

/** Step 2: the three things the stylist and the renderer need to know about you. */
export function PreferencesStep({ prefs, onBack }: { prefs: CurrentUser["prefs"]; onBack: () => void }) {
  const router = useRouter();
  const updatePrefs = useMutation(api.users.updatePrefs);
  const completeOnboarding = useMutation(api.users.completeOnboarding);
  const cityId = useId();
  const coloursId = useId();

  const [presentation, setPresentation] = useState<Presentation>(prefs.presentation);
  const [fit, setFit] = useState<Fit>(prefs.fit);
  const [avoidColours, setAvoidColours] = useState<string[]>(prefs.avoidColours);
  const [homeCity, setHomeCity] = useState(prefs.homeCity ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFinish() {
    setPending(true);
    setError(null);
    try {
      const city = homeCity.trim();
      await updatePrefs({ prefs: { presentation, fit, avoidColours, ...(city ? { homeCity: city } : {}) } });
      await completeOnboarding({});
      toast.success("You're all set. Let's fill that wardrobe.");
      router.replace(routes.wardrobe);
    } catch (caught) {
      setError(reportError(caught).message);
      setPending(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <FieldGroup>
        <FieldSet disabled={pending}>
          <FieldLegend variant="label">How should outfits be styled?</FieldLegend>
          <FieldDescription>
            Used for silhouettes and proportions, not for what the stylist will suggest.
          </FieldDescription>
          <SingleToggleGroup
            options={PRESENTATIONS}
            value={presentation}
            onValueChange={setPresentation}
            label={(option) => `${option[0].toUpperCase()}${option.slice(1)}`}
            disabled={pending}
            aria-label="Presentation"
          />
          <p className="text-muted-foreground text-sm">{PRESENTATION_HINTS[presentation]}</p>
        </FieldSet>

        <FieldSet disabled={pending}>
          <FieldLegend variant="label">Preferred fit</FieldLegend>
          <FieldDescription>Your default when the stylist has a choice between two similar pieces.</FieldDescription>
          <SingleToggleGroup options={FITS} value={fit} onValueChange={setFit} disabled={pending} aria-label="Fit" />
        </FieldSet>

        <Field>
          <FieldLabel htmlFor={coloursId}>Colours to avoid</FieldLabel>
          <ChipsInput
            id={coloursId}
            value={avoidColours}
            onValueChange={setAvoidColours}
            placeholder="e.g. neon green"
            disabled={pending}
            swatches
          />
          <FieldDescription>Anything you never want suggested. Press Enter after each one.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor={cityId}>Home city</FieldLabel>
          <Input
            id={cityId}
            value={homeCity}
            onChange={(event) => setHomeCity(event.target.value)}
            placeholder="London"
            autoComplete="address-level2"
            disabled={pending}
          />
          <FieldDescription>Lets the stylist check the weather before it picks a coat. Optional.</FieldDescription>
        </Field>
      </FieldGroup>

      {error ? <ErrorAlert message={error} onRetry={handleFinish} /> : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button variant="ghost" onClick={onBack} disabled={pending}>
          <ArrowLeft data-icon="inline-start" />
          Back to photos
        </Button>
        <Button size="lg" onClick={handleFinish} disabled={pending}>
          {pending ? <Spinner data-icon="inline-start" /> : <Check data-icon="inline-start" />}
          Finish setup
        </Button>
      </div>
    </div>
  );
}
