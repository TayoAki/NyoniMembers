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
import { FITS, type Fit } from "@convex/shared/wardrobe";

/** Step 2: the three things the concierge and the renderer need to know about you. */
export function PreferencesStep({
  prefs,
  onBack,
}: {
  prefs: CurrentUser["prefs"];
  onBack: (draft: CurrentUser["prefs"]) => void;
}) {
  const router = useRouter();
  const updatePrefs = useMutation(api.users.updatePrefs);
  const completeOnboarding = useMutation(api.users.completeOnboarding);
  const cityId = useId();
  const coloursId = useId();

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
      await updatePrefs({
        prefs: { presentation: "masculine", fit, avoidColours, ...(city ? { homeCity: city } : {}) },
      });
      await completeOnboarding({});
      toast.success("You're all set. The Nyoni capsule is on its way to your wardrobe.");
      router.replace(routes.wardrobe);
    } catch (caught) {
      setError(reportError(caught).message);
      setPending(false);
    }
  }

  return (
    <div className="space-y-7">
      <FieldGroup className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
        <FieldSet disabled={pending}>
          <FieldLegend variant="label">Preferred fit</FieldLegend>
          <FieldDescription>Your default when the concierge has a choice between two similar pieces.</FieldDescription>
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
            placeholder="Charlotte"
            autoComplete="address-level2"
            disabled={pending}
          />
          <FieldDescription>Optional location for your styling preferences.</FieldDescription>
        </Field>
      </FieldGroup>

      {error ? <ErrorAlert message={error} onRetry={handleFinish} /> : null}

      <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-between">
        <Button
          variant="ghost"
          onClick={() => onBack({ presentation: "masculine", fit, avoidColours, homeCity })}
          disabled={pending}
        >
          <ArrowLeft data-icon="inline-start" />
          Back to photos
        </Button>
        <Button size="lg" className="h-11 rounded-sm px-6" onClick={handleFinish} disabled={pending}>
          {pending ? <Spinner data-icon="inline-start" /> : <Check data-icon="inline-start" />}
          Finish setup
        </Button>
      </div>
    </div>
  );
}
