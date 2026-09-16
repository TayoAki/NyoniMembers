"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";

type ThemeOption = { value: string; label: string; description: string; icon: LucideIcon };

const OPTIONS: readonly ThemeOption[] = [
  { value: "light", label: "Light", description: "Always the light palette.", icon: Sun },
  { value: "dark", label: "Dark", description: "Always the dark palette.", icon: Moon },
  { value: "system", label: "System", description: "Follow your device setting.", icon: Monitor },
];

/** Hydration probe: false on the server and during hydration, true afterwards. No effect, no cascading render. */
const subscribeToNothing = () => () => {};
const isMounted = () => true;
const isNotMounted = () => false;

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  // `theme` is only known in the browser, so the radios wait for hydration rather than flashing the wrong one.
  const mounted = useSyncExternalStore(subscribeToNothing, isMounted, isNotMounted);

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Applies to this browser only.</CardDescription>
      </CardHeader>
      <CardContent>
        {!mounted ? (
          <div className="grid gap-2 sm:grid-cols-3" aria-busy="true" aria-label="Loading theme">
            {OPTIONS.map((option) => (
              <Skeleton key={option.value} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : (
          <RadioGroup
            aria-label="Theme"
            className="sm:grid-cols-3"
            value={theme ?? "system"}
            onValueChange={(value) => setTheme(String(value))}
          >
            {OPTIONS.map((option) => (
              <FieldLabel key={option.value} htmlFor={`theme-${option.value}`}>
                <Field orientation="horizontal">
                  <FieldContent>
                    <FieldTitle>
                      <option.icon className="text-muted-foreground size-4" aria-hidden />
                      {option.label}
                    </FieldTitle>
                    <FieldDescription>{option.description}</FieldDescription>
                  </FieldContent>
                  <RadioGroupItem id={`theme-${option.value}`} value={option.value} />
                </Field>
              </FieldLabel>
            ))}
          </RadioGroup>
        )}
      </CardContent>
    </Card>
  );
}
