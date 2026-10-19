"use client";

import { useEffect, useId, useMemo, useState, type ChangeEvent } from "react";
import { CORRECTION_PHOTOS_MAX, PHOTO_SENTENCE } from "@/components/atelier/aftercare/aftercare-words";
import { ItemImage } from "@/components/common/item-image";
import { Button, buttonVariants } from "@/components/ui/button";
import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field";
import { formatBytes, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ATELIER_LIMITS } from "@convex/shared/atelier/enums";

/**
 * Optional supporting photographs for a correction (C24). Files stay in the browser until the request
 * is sent; nothing is stored before then, and the sentence beside the control says who sees them.
 */
export function CorrectionPhotosField({
  files,
  onChange,
  disabled = false,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [problem, setProblem] = useState<string | null>(null);
  const full = files.length >= CORRECTION_PHOTOS_MAX;

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (chosen.length === 0) return;
    const problems: string[] = [];
    const accepted: File[] = [];
    for (const file of chosen) {
      if (!file.type.startsWith("image/")) problems.push(`${file.name} is not a photograph.`);
      else if (file.size > ATELIER_LIMITS.maxPhotoBytes)
        problems.push(`${file.name} is larger than ${formatBytes(ATELIER_LIMITS.maxPhotoBytes)}.`);
      else accepted.push(file);
    }
    const room = CORRECTION_PHOTOS_MAX - files.length;
    if (accepted.length > room)
      problems.push(`Up to ${pluralize(CORRECTION_PHOTOS_MAX, "photograph")} can accompany a correction.`);
    setProblem(problems.length > 0 ? problems.join(" ") : null);
    if (accepted.length > 0) onChange([...files, ...accepted.slice(0, Math.max(0, room))]);
  }

  return (
    <FieldSet>
      <FieldLegend variant="label">
        Photographs <span className="font-normal text-muted-foreground">(optional)</span>
      </FieldLegend>
      <FieldDescription>{PHOTO_SENTENCE}</FieldDescription>
      {files.length > 0 ? (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6" aria-label="Photographs to send">
          {files.map((file, index) => (
            <PhotoThumb
              key={`${file.name}-${file.size}-${index}`}
              file={file}
              disabled={disabled}
              onRemove={() => onChange(files.filter((_, i) => i !== index))}
            />
          ))}
        </ul>
      ) : null}
      <input
        id={id}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={pick}
        disabled={disabled || full}
      />
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={id}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-11 cursor-pointer rounded-none px-4",
            (disabled || full) && "pointer-events-none opacity-50",
          )}
        >
          {files.length > 0 ? "Add another photograph" : "Add a photograph"}
        </label>
        <span className="text-xs text-muted-foreground">
          {files.length > 0
            ? `${pluralize(files.length, "photograph")} chosen · not sent yet`
            : `Up to ${CORRECTION_PHOTOS_MAX}, ${formatBytes(ATELIER_LIMITS.maxPhotoBytes)} each`}
        </span>
      </div>
      {problem ? (
        <p className="text-xs text-destructive" role="alert">
          {problem}
        </p>
      ) : null}
    </FieldSet>
  );
}

function PhotoThumb({ file, disabled, onRemove }: { file: File; disabled: boolean; onRemove: () => void }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <li className="space-y-1">
      <ItemImage
        src={url}
        alt={`${file.name}, not yet sent`}
        variant="photo"
        aspect="aspect-square"
        className="rounded-none"
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 w-full rounded-none px-2 text-muted-foreground hover:text-foreground"
        onClick={onRemove}
        disabled={disabled}
      >
        Remove
      </Button>
    </li>
  );
}
