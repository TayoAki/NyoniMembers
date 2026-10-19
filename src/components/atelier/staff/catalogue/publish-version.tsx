"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { Mono } from "@/components/atelier/common/mono";
import { ErrorAlert } from "@/components/common/error-alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { toClientError } from "@/lib/errors";
import { formatDateTime, pluralize } from "@/lib/format";
import { api } from "@convex/_generated/api";
import type { Infer } from "convex/values";
import type { vCatalogueVersionView } from "@convex/atelier/catalogue";

export type CatalogueVersion = Infer<typeof vCatalogueVersionView>;

/**
 * O02 step 3: publishing stamps every entry changed since the last version. Drafts compare their catalogue
 * version to the new number and revalidate themselves; a withdrawn or changed cloth becomes a warning the
 * client must acknowledge, never a silent substitution.
 */
export function PublishVersionDialog({
  currentVersion,
  pendingCount,
}: {
  currentVersion: number;
  pendingCount: number;
}) {
  const publish = useMutation(api.atelier.catalogue.publishVersion);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstPublish = currentVersion === 0;
  const nothingChanged = !firstPublish && pendingCount === 0;

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const result = await publish({ note: note.trim() });
      toast.success(
        `Version ${result.version} published; ${pluralize(result.stamped, "entry", "entries")} stamped. Drafts revalidate against it.`,
      );
      setNote("");
      setOpen(false);
    } catch (caught) {
      setError(toClientError(caught).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger render={<Button className="h-10 rounded-none px-4" />}>Publish version</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {firstPublish ? "Publish the first catalogue version" : `Publish version ${currentVersion + 1}`}
          </DialogTitle>
          <DialogDescription>
            {firstPublish
              ? "The house's range is seeded and published as version 1, credited to you."
              : nothingChanged
                ? `Nothing has changed since version ${currentVersion} was published.`
                : `${pluralize(pendingCount, "entry", "entries")} changed since version ${currentVersion} will carry the new number. Every open design compares its catalogue version to it and revalidates: a withdrawn or changed cloth becomes a warning the client must acknowledge before requesting a quote.`}
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="publish-note">What changed</FieldLabel>
          <FieldDescription>Kept with the version for the audit trail.</FieldDescription>
          <Textarea id="publish-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
        </Field>
        {error ? <ErrorAlert title="The version was not published" message={error} /> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={pending || nothingChanged || note.trim().length === 0}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The published versions, newest first: who, when, and the note. */
export function VersionHistory({ versions }: { versions: CatalogueVersion[] }) {
  if (versions.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        No version has been published yet; the first publish seeds the house&rsquo;s range.
      </p>
    );
  return (
    <ol className="divide-y divide-foreground/10 border-y border-foreground/15 text-sm">
      {versions.map((version) => (
        <li key={version._id} className="grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[minmax(7rem,11rem)_1fr]">
          <div className="flex flex-col gap-0.5">
            <span className="flex items-baseline gap-2">
              <Mono>v{version.version}</Mono>
              {version.isCurrent ? <span className="text-xs text-foreground">Current</span> : null}
            </span>
            <Mono upper={false} className="text-[11px]">
              {formatDateTime(version.publishedAt)}
            </Mono>
          </div>
          <div className="min-w-0">
            <p className="leading-relaxed">{version.note}</p>
            <p className="text-xs text-muted-foreground">Published by {version.publishedByName ?? "the house"}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
