"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { ErrorAlert } from "@/components/common/error-alert";
import { ItemImage } from "@/components/common/item-image";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { reportError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { FitPhotoView, FitReviewView } from "@convex/atelier/fit";

const POSE_WORDS: Record<FitPhotoView["pose"], string> = { front: "Front", side: "Side", back: "Back" };

/**
 * The client's posture photographs, behind one explicit action. The URLs come from a mutation so every
 * look is written to the audit log as `photo.view` under the fitter's name; the page says so before
 * the button is pressed.
 */
export function FitPhotos({
  profileId,
  photos,
}: {
  profileId: Id<"atelierFitProfiles">;
  photos: FitReviewView["profile"]["photos"];
}) {
  const reveal = useMutation(api.atelier.fit.staffPhotoUrls);
  const [urls, setUrls] = useState<FitPhotoView[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (photos.length === 0) {
    return <p className="text-sm text-muted-foreground">No posture photographs were sent with this version.</p>;
  }

  async function open() {
    setPending(true);
    setError(null);
    try {
      setUrls(await reveal({ profileId }));
    } catch (caught) {
      setError(reportError(caught).message);
    } finally {
      setPending(false);
    }
  }

  if (urls === null) {
    return (
      <div className="space-y-3">
        <ul className="text-sm text-muted-foreground">
          {photos.map((photo) => (
            <li key={photo.photoId}>
              {POSE_WORDS[photo.pose]} view · sent {formatDateTime(photo.createdAt)}
            </li>
          ))}
        </ul>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Opening them is recorded in the audit log under your name (
          <span className="font-mono text-xs">photo.view</span>), one entry per photograph. They are for fitting only
          and never leave the house.
        </p>
        {error ? <ErrorAlert title="The photographs did not open" message={error} onRetry={() => void open()} /> : null}
        <Button variant="outline" disabled={pending} onClick={() => void open()}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          View photographs
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Recorded in the audit log under your name.</p>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {urls.map((photo) => (
          <li key={photo.photoId} className="space-y-1.5">
            {photo.url ? (
              <ItemImage
                src={photo.url}
                alt={`${POSE_WORDS[photo.pose]} view of the client`}
                variant="photo"
                className="rounded-sm"
              />
            ) : (
              <div className="flex aspect-[3/4] items-center justify-center rounded-sm bg-muted p-3 text-center text-xs text-muted-foreground">
                This file is gone.
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {POSE_WORDS[photo.pose]} · {formatDateTime(photo.createdAt)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
