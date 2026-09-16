"use client";

import { useMutation } from "convex/react";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useCurrentUser, type CurrentUser } from "@/hooks/use-current-user";
import { reportError } from "@/lib/errors";
import { titleCase } from "@/lib/format";
import { api } from "@convex/_generated/api";
import { FITS, PRESENTATIONS } from "@convex/shared/wardrobe";

type Prefs = CurrentUser["prefs"];

const MAX_AVOID_COLOURS = 12;

/** Base UI toggle groups are multi-select by shape; this pins one valid value. */
function pickOne<T extends string>(allowed: readonly T[], next: readonly string[]): T | null {
  const candidate = next[0];
  return candidate !== undefined && (allowed as readonly string[]).includes(candidate) ? (candidate as T) : null;
}

function sameColours(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((colour, index) => colour === b[index]);
}

function isDirty(draft: Prefs, saved: Prefs): boolean {
  return (
    draft.presentation !== saved.presentation ||
    draft.fit !== saved.fit ||
    (draft.homeCity ?? "") !== (saved.homeCity ?? "") ||
    !sameColours(draft.avoidColours, saved.avoidColours)
  );
}

export function PreferencesForm() {
  const { user, isLoading } = useCurrentUser();
  if (isLoading || !user) return <PreferencesSkeleton />;
  return <PreferencesFields initial={user.prefs} />;
}

function PreferencesFields({ initial }: { initial: Prefs }) {
  const updatePrefs = useMutation(api.users.updatePrefs);
  const [saved, setSaved] = useState<Prefs>(initial);
  const [draft, setDraft] = useState<Prefs>(initial);
  const [colourInput, setColourInput] = useState("");
  const [saving, setSaving] = useState(false);
  const dirty = isDirty(draft, saved);

  function addColour() {
    const colour = colourInput.trim().toLowerCase();
    if (!colour) return;
    if (draft.avoidColours.includes(colour)) {
      setColourInput("");
      return;
    }
    if (draft.avoidColours.length >= MAX_AVOID_COLOURS) {
      toast.error(`That is enough colours to avoid — ${MAX_AVOID_COLOURS} is the limit.`);
      return;
    }
    setDraft({ ...draft, avoidColours: [...draft.avoidColours, colour] });
    setColourInput("");
  }

  async function handleSave() {
    setSaving(true);
    const next: Prefs = { ...draft, homeCity: draft.homeCity?.trim() ? draft.homeCity.trim() : undefined };
    try {
      await updatePrefs({ prefs: next });
      setSaved(next);
      setDraft(next);
      toast.success("Preferences saved.");
    } catch (error) {
      reportError(error, "Could not save your preferences.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Styling preferences</CardTitle>
        <CardDescription>The stylist and every render read these before suggesting anything.</CardDescription>
      </CardHeader>

      <CardContent>
        <FieldGroup>
          <Field>
            <FieldTitle>Presentation</FieldTitle>
            <FieldDescription>How outfits should be cut and styled for you.</FieldDescription>
            <ToggleGroup
              variant="outline"
              spacing={0}
              aria-label="Presentation"
              value={[draft.presentation]}
              onValueChange={(next) => {
                const value = pickOne(PRESENTATIONS, next);
                if (value) setDraft({ ...draft, presentation: value });
              }}
            >
              {PRESENTATIONS.map((option) => (
                <ToggleGroupItem key={option} value={option}>
                  {titleCase(option)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>

          <Field>
            <FieldTitle>Preferred fit</FieldTitle>
            <FieldDescription>Used when an item could be worn more than one way.</FieldDescription>
            <ToggleGroup
              variant="outline"
              spacing={0}
              aria-label="Preferred fit"
              value={[draft.fit]}
              onValueChange={(next) => {
                const value = pickOne(FITS, next);
                if (value) setDraft({ ...draft, fit: value });
              }}
            >
              {FITS.map((option) => (
                <ToggleGroupItem key={option} value={option}>
                  {titleCase(option)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>

          <Field>
            <FieldLabel htmlFor="avoid-colour">Colours to avoid</FieldLabel>
            <FieldDescription>Outfit suggestions will steer around these.</FieldDescription>
            <div className="flex gap-2">
              <Input
                id="avoid-colour"
                value={colourInput}
                placeholder="mustard"
                autoComplete="off"
                onChange={(event) => setColourInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addColour();
                  }
                }}
              />
              <Button variant="outline" onClick={addColour} disabled={!colourInput.trim()}>
                <Plus data-icon="inline-start" aria-hidden />
                Add
              </Button>
            </div>
            {draft.avoidColours.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5">
                {draft.avoidColours.map((colour) => (
                  <li key={colour}>
                    <Badge variant="secondary" className="h-6 gap-1 pr-1 pl-2.5 capitalize">
                      {colour}
                      <button
                        type="button"
                        aria-label={`Stop avoiding ${colour}`}
                        onClick={() =>
                          setDraft({ ...draft, avoidColours: draft.avoidColours.filter((entry) => entry !== colour) })
                        }
                        className="text-muted-foreground hover:bg-foreground/10 hover:text-foreground focus-visible:ring-ring/50 rounded-full p-0.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">
                Nothing ruled out — every colour in your wardrobe is fair game.
              </p>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="home-city">Home city</FieldLabel>
            <FieldDescription>Lets the stylist check the weather before recommending an outfit.</FieldDescription>
            <Input
              id="home-city"
              value={draft.homeCity ?? ""}
              placeholder="London"
              autoComplete="address-level2"
              onChange={(event) => setDraft({ ...draft, homeCity: event.target.value })}
            />
          </Field>
        </FieldGroup>
      </CardContent>

      <CardFooter className="justify-end gap-2">
        <Button variant="ghost" disabled={!dirty || saving} onClick={() => setDraft(saved)}>
          Discard
        </Button>
        <Button disabled={!dirty || saving} onClick={() => void handleSave()}>
          {saving ? <Spinner data-icon="inline-start" /> : null}
          Save changes
        </Button>
      </CardFooter>
    </Card>
  );
}

function PreferencesSkeleton() {
  return (
    <Card aria-busy="true" aria-label="Loading preferences">
      <CardHeader className="border-b">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-64" />
      </CardHeader>
      <CardContent className="space-y-5">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-full max-w-sm rounded-lg" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
