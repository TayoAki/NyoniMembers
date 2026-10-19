"use client";

import { useMutation } from "convex/react";
import { ImageOff } from "lucide-react";
import { POSE_LABELS } from "@/components/atelier/fit/fit-words";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ItemImage } from "@/components/common/item-image";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { api } from "@convex/_generated/api";
import type { FitPhotoView } from "@convex/atelier/fit";

/** The posture photographs on a profile: private thumbnails for the client, each removable. */
export function FitPhotoList({ photos }: { photos: FitPhotoView[] }) {
  const remove = useMutation(api.atelier.fit.removeFitPhoto);
  if (photos.length === 0) return <p className="text-sm text-muted-foreground">None added.</p>;

  return (
    <ul className="grid grid-cols-3 gap-4 sm:max-w-lg" aria-label="Posture photographs">
      {photos.map((photo) => (
        <li key={photo.photoId} className="space-y-2">
          {photo.url ? (
            <ItemImage
              src={photo.url}
              alt={`${POSE_LABELS[photo.pose]} posture photograph`}
              variant="photo"
              className="rounded-none"
            />
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center border border-dashed border-foreground/20 text-muted-foreground">
              <ImageOff className="size-5" aria-hidden />
              <span className="sr-only">File no longer available</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium">{POSE_LABELS[photo.pose]}</span>
            <ConfirmDialog
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 rounded-none px-2 text-muted-foreground hover:text-foreground"
                >
                  Remove
                </Button>
              }
              title={`Remove the ${POSE_LABELS[photo.pose].toLowerCase()} photograph?`}
              description="The file is deleted from the house's systems. Your measurements and the profile itself stay exactly as they are."
              confirmLabel="Remove"
              destructive
              onConfirm={() => remove({ photoId: photo.photoId })}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">Added {formatDate(photo.createdAt)}</p>
        </li>
      ))}
    </ul>
  );
}
