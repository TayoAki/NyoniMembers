"use client";

import type { PersonPhotoView } from "@convex/atelier/photos";
import { CONSENT_VERSION } from "@convex/shared/atelier/policy";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ItemImage } from "@/components/common/item-image";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

type PhotoControlsProps = {
  photo: PersonPhotoView;
  onReplace: () => void;
  onRemove: () => Promise<void>;
  disabled?: boolean;
};

/**
 * C11: the photograph the previews are made from, what is kept and until when, and the two controls:
 * replace (the server retires the old photograph and everything made from it once the new one is
 * accepted) and remove (deleted now, with its previews; the design stays).
 */
export function PhotoControls({ photo, onReplace, onRemove, disabled = false }: PhotoControlsProps) {
  const advisory = photo.validation.ok ? photo.validation.reasons : [];
  return (
    <section aria-labelledby="photo-controls-title" className="border-t border-foreground/15 pt-6">
      <h2 id="photo-controls-title" className="text-xl font-medium tracking-tight sm:text-2xl">
        Your photograph
      </h2>
      <div className="mt-4 grid gap-5 sm:grid-cols-[minmax(0,7rem)_1fr]">
        <ItemImage
          src={photo.url}
          alt="Your photograph, as you added it"
          variant="photo"
          aspect="aspect-[3/4]"
          className="w-full max-w-28 rounded-none"
        />
        <div className="min-w-0 space-y-3 text-sm">
          <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[minmax(6rem,8rem)_1fr]">
            <dt className="text-xs font-medium tracking-wide text-muted-foreground">Added</dt>
            <dd>{formatDate(photo.consentAt)}</dd>
            <dt className="text-xs font-medium tracking-wide text-muted-foreground">Kept until</dt>
            <dd>{formatDate(photo.expiresAt)}, unless you remove it sooner</dd>
            <dt className="text-xs font-medium tracking-wide text-muted-foreground">Terms</dt>
            <dd>
              <Mono upper={false}>v{photo.consentVersion}</Mono>
              {!photo.consentCurrent ? (
                <span className="ml-2 text-xs text-muted-foreground">current: v{CONSENT_VERSION}</span>
              ) : null}
            </dd>
            <dt className="text-xs font-medium tracking-wide text-muted-foreground">Size</dt>
            <dd>
              <Mono>
                {photo.width} × {photo.height} px
              </Mono>
            </dd>
          </dl>
          {advisory.map((reason) => (
            <p key={reason} className="text-xs leading-relaxed text-muted-foreground">
              {reason}
            </p>
          ))}
          {!photo.consentCurrent ? (
            <StatusLine tone="warning" className="text-pretty">
              The photo terms have changed since this photograph was added. Add it again under the current terms to make
              new previews.
            </StatusLine>
          ) : null}
          <div className="flex flex-wrap gap-3 pt-1">
            <Button variant="outline" className="min-h-11 rounded-sm" onClick={onReplace} disabled={disabled}>
              Replace photograph
            </Button>
            <ConfirmDialog
              trigger={
                <Button variant="destructive" className="min-h-11 rounded-sm" disabled={disabled}>
                  Remove photograph
                </Button>
              }
              title="Remove your photograph?"
              description="This deletes the photograph and every preview made from it from the house's systems, now. A preview still being made is cancelled. Your design stays exactly as it is."
              confirmLabel="Remove photograph"
              destructive
              onConfirm={onRemove}
            />
          </div>
          <p className="text-xs leading-relaxed text-pretty text-muted-foreground">
            Replacing goes through the photo terms again; when the new photograph is accepted, this one and its previews
            are deleted.
          </p>
        </div>
      </div>
    </section>
  );
}
