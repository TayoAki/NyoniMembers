"use client";

import { useEffect, useId, useMemo, useState, type ChangeEvent } from "react";
import { FIT_PHOTO_CONSENT, POSE_GUIDES, POSE_LABELS } from "@/components/atelier/fit/fit-words";
import { ItemImage } from "@/components/common/item-image";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ATELIER_LIMITS, FIT_PHOTO_POSES, type FitPhotoPose } from "@convex/shared/atelier/enums";

export type PoseFiles = Record<FitPhotoPose, File | null>;
export const EMPTY_POSES: PoseFiles = { front: null, side: null, back: null };

/**
 * Optional posture photographs for the fitter (C17), under their own consent sentence. Files are held
 * locally until the sheet is submitted; nothing is uploaded before a profile version exists to join.
 */
export function PosturePhotosField({
  files,
  onChange,
  consent,
  onConsentChange,
  disabled = false,
}: {
  files: PoseFiles;
  onChange: (files: PoseFiles) => void;
  consent: boolean;
  onConsentChange: (consent: boolean) => void;
  disabled?: boolean;
}) {
  const ids = useId();
  return (
    <FieldSet>
      <FieldLegend variant="label">
        Posture photographs <span className="font-normal text-muted-foreground">(optional)</span>
      </FieldLegend>
      <FieldDescription>{FIT_PHOTO_CONSENT}</FieldDescription>
      <FieldLabel className="min-h-11 items-start gap-3 font-normal">
        <Checkbox
          checked={consent}
          onCheckedChange={(checked) => onConsentChange(checked)}
          disabled={disabled}
          className="mt-0.5"
        />
        <span className="text-sm leading-relaxed">
          I agree: these photographs are for the fitter’s review of my posture and for nothing else, and I can remove
          them at any time.
        </span>
      </FieldLabel>
      <div className="grid gap-5 sm:grid-cols-3">
        {FIT_PHOTO_POSES.map((pose) => (
          <PosePicker
            key={pose}
            id={`${ids}-${pose}`}
            pose={pose}
            file={files[pose]}
            disabled={disabled || !consent}
            onChange={(file) => onChange({ ...files, [pose]: file })}
          />
        ))}
      </div>
    </FieldSet>
  );
}

function PosePicker({
  id,
  pose,
  file,
  disabled,
  onChange,
}: {
  id: string;
  pose: FitPhotoPose;
  file: File | null;
  disabled: boolean;
  onChange: (file: File | null) => void;
}) {
  const [problem, setProblem] = useState<string | null>(null);
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!chosen) return;
    if (!chosen.type.startsWith("image/")) {
      setProblem("Choose a photograph (JPG, PNG, HEIC or WebP).");
      return;
    }
    if (chosen.size > ATELIER_LIMITS.maxPhotoBytes) {
      setProblem(`That file is larger than ${formatBytes(ATELIER_LIMITS.maxPhotoBytes)}.`);
      return;
    }
    setProblem(null);
    onChange(chosen);
  }

  return (
    <div className="space-y-2">
      <div className="flex min-h-9 items-center justify-between gap-2">
        <span className="text-sm font-medium">{POSE_LABELS[pose]}</span>
        {file ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 rounded-none px-2 text-muted-foreground hover:text-foreground"
            onClick={() => onChange(null)}
            disabled={disabled}
          >
            Remove
          </Button>
        ) : null}
      </div>
      {url ? (
        <ItemImage
          src={url}
          alt={`${POSE_LABELS[pose]} photograph, not yet sent`}
          variant="photo"
          className="rounded-none"
        />
      ) : (
        <p className="min-h-10 text-xs leading-relaxed text-muted-foreground">{POSE_GUIDES[pose]}</p>
      )}
      <input id={id} type="file" accept="image/*" className="sr-only" onChange={pick} disabled={disabled} />
      <label
        htmlFor={id}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-11 w-full cursor-pointer rounded-none",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        {file ? "Replace" : "Add photograph"}
      </label>
      {file ? (
        <p className="text-xs text-muted-foreground">
          {file.name} · {formatBytes(file.size)} · not sent yet
        </p>
      ) : null}
      {problem ? (
        <p className="text-xs text-destructive" role="alert">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
