"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { signInHref } from "@/components/atelier/fit/fit-words";
import {
  fromDateInput,
  GROUP_BRIEF_MAX,
  GROUP_NAME_MAX,
  GROUP_REVIEW_SENTENCE,
  PERMITTED_LABELS,
  PERMITTED_PATHS,
} from "@/components/atelier/groups/group-words";
import { SharedSpecFields } from "@/components/atelier/groups/shared-spec-fields";
import { ShadeChip } from "@/components/atelier/studio/cloth/shade-chip";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { toClientError, type ClientError } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { api } from "@convex/_generated/api";
import type { PermittedIndividualPath } from "@convex/atelier/groups";
import { OCCASION_BLURBS, OCCASION_LABELS, OCCASIONS, type Occasion } from "@convex/shared/atelier/enums";
import { eventReadiness } from "@convex/shared/atelier/policy";
import { applyChange, DEFAULT_SPEC, type Conflict, type SpecPatch, type SuitSpec } from "@convex/shared/atelier/spec";

/** The select's value for "each participant chooses their own cloth" — the shared design leaves it open. */
const EACH_CHOOSES = "__each__";

function isOccasion(value: string): value is Occasion {
  return (OCCASIONS as readonly string[]).includes(value);
}

type Errors = { name?: string; brief?: string; eventDate?: string };

/**
 * S35 · a new group (C28): the brief, the shared design as compact option lists seeded from the studio's
 * defaults, the cloth from the house's range (or left to each person), and the details each participant may
 * choose for themselves. Nothing is sent to the house by creating a group; the house reviews it later.
 */
export function GroupCreateForm({ onCancel }: { onCancel: () => void }) {
  const id = useId();
  const router = useRouter();
  const pathname = usePathname();
  const create = useMutation(api.atelier.groups.create);
  const cloths = useQuery(api.atelier.catalogue.list, { kind: "cloth" });

  const [name, setName] = useState("");
  const [occasion, setOccasion] = useState<Occasion>("wedding");
  const [eventDate, setEventDate] = useState("");
  const [brief, setBrief] = useState("");
  const [spec, setSpec] = useState<SuitSpec>(DEFAULT_SPEC);
  const [moved, setMoved] = useState<Conflict[]>([]);
  const [permitted, setPermitted] = useState<ReadonlySet<PermittedIndividualPath>>(() => new Set());
  const [attempted, setAttempted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ClientError | null>(null);
  const [now] = useState(() => Date.now());

  const eventMs = eventDate ? fromDateInput(eventDate) : null;
  const readiness = eventMs !== null ? eventReadiness(eventMs, now) : null;
  const chosenCloth = spec.clothCode ? cloths?.find((entry) => entry.code === spec.clothCode) : undefined;

  const errors: Errors = {};
  if (name.trim().length === 0) errors.name = "Give the group a name.";
  else if (name.trim().length > GROUP_NAME_MAX) errors.name = `Keep the name to ${GROUP_NAME_MAX} characters.`;
  if (brief.length > GROUP_BRIEF_MAX) errors.brief = `Keep the brief to ${GROUP_BRIEF_MAX} characters.`;
  if (eventDate && eventMs === null) errors.eventDate = "Choose a date for the event.";
  else if (eventMs !== null && eventMs < now - 86_400_000) errors.eventDate = "The event date has passed.";
  const shown: Errors = attempted ? errors : {};
  const valid = Object.keys(errors).length === 0;

  const change = (patch: SpecPatch) => {
    const result = applyChange(spec, patch);
    setSpec(result.spec);
    setMoved(result.conflicts);
  };

  const togglePermitted = (path: PermittedIndividualPath, on: boolean) => {
    setPermitted((current) => {
      const next = new Set(current);
      if (on) next.add(path);
      else next.delete(path);
      return next;
    });
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAttempted(true);
    if (!valid) return;
    setPending(true);
    setError(null);
    try {
      const groupId = await create({
        name: name.trim(),
        occasion,
        eventDate: eventMs ?? undefined,
        brief: brief.trim(),
        sharedSpec: spec,
        permittedIndividual: PERMITTED_PATHS.filter((path) => permitted.has(path)),
      });
      toast.success("Group created.", { description: "Invite the first participant to open it." });
      router.push(routes.atelier.group(groupId));
    } catch (failure) {
      const clientError = toClientError(failure);
      setError(clientError);
      toast.error(clientError.message);
      setPending(false);
    }
  };

  return (
    <AtelierSection
      id="new-group"
      title="A new group"
      description="One brief and one shared design. Each participant starts from it, designs and is fitted privately, and the house reviews the whole before anything is cut."
      actions={
        <Button variant="ghost" className="h-11 rounded-none px-4" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      }
    >
      <form onSubmit={(event) => void submit(event)} noValidate className="space-y-10">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field data-invalid={shown.name ? true : undefined} className="sm:col-span-2">
            <FieldLabel htmlFor={`${id}-name`}>Group name</FieldLabel>
            <Input
              id={`${id}-name`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Okafor wedding party"
              maxLength={GROUP_NAME_MAX + 20}
              disabled={pending}
              aria-invalid={shown.name ? true : undefined}
              className="h-11 rounded-none"
            />
            <FieldError>{shown.name}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor={`${id}-occasion`}>Occasion</FieldLabel>
            <Select
              items={OCCASION_LABELS}
              value={occasion}
              onValueChange={(next) => {
                const value = String(next);
                if (isOccasion(value)) setOccasion(value);
              }}
              disabled={pending}
            >
              <SelectTrigger id={`${id}-occasion`} className="h-11 w-full rounded-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                {OCCASIONS.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {OCCASION_LABELS[entry]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>{OCCASION_BLURBS[occasion]}</FieldDescription>
          </Field>

          <Field data-invalid={shown.eventDate ? true : undefined}>
            <FieldLabel htmlFor={`${id}-date`}>
              Event date <span className="font-normal text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Input
              id={`${id}-date`}
              type="date"
              value={eventDate}
              onChange={(event) => setEventDate(event.target.value)}
              disabled={pending}
              aria-invalid={shown.eventDate ? true : undefined}
              className="h-11 rounded-none"
            />
            <FieldError>{shown.eventDate}</FieldError>
            {readiness && readiness.state !== "none" && !shown.eventDate ? (
              <FieldDescription className={cn(readiness.state !== "comfortable" && "text-warning")}>
                {readiness.copy}
              </FieldDescription>
            ) : null}
          </Field>

          <Field data-invalid={shown.brief ? true : undefined} className="sm:col-span-2">
            <FieldLabel htmlFor={`${id}-brief`}>
              The brief <span className="font-normal text-muted-foreground">(optional)</span>
            </FieldLabel>
            <Textarea
              id={`${id}-brief`}
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              rows={4}
              placeholder="What the group should share, and what is each person's own."
              disabled={pending}
              aria-invalid={shown.brief ? true : undefined}
              className="min-h-28 rounded-none"
            />
            <FieldDescription>
              Read by every participant and by the house. {brief.length} of {GROUP_BRIEF_MAX} characters.
            </FieldDescription>
            <FieldError>{shown.brief}</FieldError>
          </Field>
        </div>

        <fieldset className="space-y-5 border-t border-foreground/15 pt-6">
          <legend className="float-left mb-2 w-full text-base font-medium">The shared design</legend>
          <p className="clear-left max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Every participant starts from these lines. Buttons and lining are chosen with the house at the fitting
            unless you leave the lining to each person below.
          </p>

          <Field>
            <FieldLabel htmlFor={`${id}-cloth`}>Cloth</FieldLabel>
            {cloths === undefined ? (
              <p
                className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                <Spinner aria-hidden /> Reading the cloth book…
              </p>
            ) : (
              <Select
                items={Object.fromEntries([
                  [EACH_CHOOSES, "Each participant chooses their own cloth"],
                  ...cloths.map((entry) => [entry.code, `${entry.name}${entry.mill ? ` · ${entry.mill}` : ""}`]),
                ])}
                value={spec.clothCode ?? EACH_CHOOSES}
                onValueChange={(next) => {
                  const value = String(next);
                  change({ clothCode: value === EACH_CHOOSES ? null : value });
                }}
                disabled={pending}
              >
                <SelectTrigger id={`${id}-cloth`} className="h-11 w-full rounded-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  <SelectItem value={EACH_CHOOSES}>Each participant chooses their own cloth</SelectItem>
                  {cloths.map((entry) => (
                    <SelectItem key={entry.code} value={entry.code}>
                      {entry.name}
                      {entry.mill ? ` · ${entry.mill}` : ""}
                      {!entry.inStock ? " — not in stock" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {chosenCloth ? (
              <FieldDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <ShadeChip hex={chosenCloth.hex} confirmed={chosenCloth.shadeConfirmed} />
                {chosenCloth.composition ? <span>{chosenCloth.composition}</span> : null}
                <span className={cn(!chosenCloth.inStock && "text-warning")}>
                  {chosenCloth.inStock ? "Available" : "Not in stock — ask your concierge"}
                </span>
              </FieldDescription>
            ) : (
              <FieldDescription>
                Leaving the cloth open keeps the cut shared while each person chooses from the house&rsquo;s range.
              </FieldDescription>
            )}
          </Field>

          <SharedSpecFields spec={spec} onChange={change} disabled={pending} idPrefix={id} />

          {moved.length > 0 ? (
            <div
              className="space-y-1 border-y border-foreground/15 py-3 text-xs leading-relaxed text-warning"
              role="status"
            >
              <p className="font-medium">Also changed to keep the design consistent:</p>
              <ul className="list-disc pl-5">
                {moved.map((conflict) => (
                  <li key={conflict.field}>
                    {conflict.label}: {conflict.from} → {conflict.to} — {conflict.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </fieldset>

        <fieldset className="space-y-4 border-t border-foreground/15 pt-6">
          <legend className="float-left mb-2 w-full text-base font-medium">Each participant may choose</legend>
          <p className="clear-left max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Tick what is theirs to decide. Everything else follows the shared design; fit and measurements are always
            each person&rsquo;s own.
          </p>
          <ul className="divide-y divide-foreground/10 border-y border-foreground/15">
            {PERMITTED_PATHS.map((path) => (
              <li key={path}>
                <label htmlFor={`${id}-permit-${path}`} className="flex min-h-11 cursor-pointer items-start gap-3 py-3">
                  <Checkbox
                    id={`${id}-permit-${path}`}
                    checked={permitted.has(path)}
                    onCheckedChange={(checked) => togglePermitted(path, checked === true)}
                    disabled={pending}
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{PERMITTED_LABELS[path].label}</span>
                    <span className="block text-xs leading-relaxed text-muted-foreground">
                      {PERMITTED_LABELS[path].description}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{GROUP_REVIEW_SENTENCE}</p>

        {error ? (
          <ErrorAlert
            title="Could not create the group"
            message={error.message}
            onRetry={() => setError(null)}
            retryLabel="Dismiss"
          />
        ) : null}
        {error?.code === "UNAUTHENTICATED" ? (
          <p className="text-sm">
            <Link href={signInHref(pathname)} className="underline underline-offset-4">
              Sign in
            </Link>{" "}
            to organize a group; what you have typed stays on this page.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" className="h-11 rounded-none px-5" disabled={pending} aria-busy={pending}>
            {pending ? <Spinner data-icon="inline-start" aria-label="Creating the group" /> : null}
            {pending ? "Creating…" : "Create the group"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-none px-5"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </Button>
        </div>
      </form>
    </AtelierSection>
  );
}
