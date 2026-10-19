"use client";

import { useMutation } from "convex/react";
import { AtelierSection } from "@/components/atelier/common/atelier-section";
import { Mono } from "@/components/atelier/common/mono";
import { StatusLine } from "@/components/atelier/common/status-line";
import {
  PENDING_DELETION_WORDS,
  PHOTO_TONES,
  RECORDED_STEPS_SENTENCE,
  REMOVE_PHOTO_WORDS,
  scopeWords,
} from "@/components/atelier/privacy/privacy-words";
import type { UsePrivacyRequest } from "@/components/atelier/privacy/use-privacy-request";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ErrorAlert } from "@/components/common/error-alert";
import { ItemImage } from "@/components/common/item-image";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useGuestKeyArg } from "@/hooks/atelier/use-owner-args";
import { reportError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { api } from "@convex/_generated/api";
import type { PersonPhotoView } from "@convex/atelier/photos";
import { ATELIER_LIMITS, PHOTO_STATUS_LABELS, PRIVACY_KIND_LABELS } from "@convex/shared/atelier/enums";

type Props = {
  photo: PersonPhotoView | null;
  signedIn: boolean;
  privacy: UsePrivacyRequest;
};

/**
 * S34 · Photographs and previews (C11): the one photograph the previews are made from, until when it is
 * kept, and its removal — now, through the studio's own mutation, or as a recorded request whose steps
 * include telling the preview provider.
 */
export function PhotoSection({ photo, signedIn, privacy }: Props) {
  const guestKeyArg = useGuestKeyArg();
  const remove = useMutation(api.atelier.photos.remove);
  const failure = privacy.failure?.kind === "delete_photos" ? privacy.failure.error : null;
  const requesting = privacy.pendingKind === "delete_photos";

  const requestRecord = async () => {
    try {
      await privacy.submit("delete_photos");
    } catch (error) {
      reportError(error);
    }
  };

  return (
    <AtelierSection
      id="photographs"
      title="Photographs and previews"
      description={`At most one photograph, kept ${ATELIER_LIMITS.previewResultDays} days for your personal previews under the photo terms you accepted. Removing it deletes every preview made from it; your design is untouched.`}
    >
      {photo === null ? (
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          No photograph is kept for {scopeWords(signedIn)}. One is added only in the studio&rsquo;s &ldquo;See it on
          you&rdquo; step, after the photo terms, and never anywhere else.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-[minmax(0,7rem)_1fr]">
          <ItemImage
            src={photo.url}
            alt={photo.url ? "Your photograph, as you added it" : "Your photograph is no longer reachable"}
            variant="photo"
            aspect="aspect-[3/4]"
            className="w-full max-w-28 rounded-none"
          />
          <div className="min-w-0 space-y-4 text-sm">
            <StatusLine tone={PHOTO_TONES[photo.status]} live className="text-sm">
              {PHOTO_STATUS_LABELS[photo.status]}
            </StatusLine>
            {photo.status === "pending_deletion" ? (
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{PENDING_DELETION_WORDS}</p>
            ) : null}
            <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[minmax(6rem,8rem)_1fr]">
              <dt className="text-xs font-medium tracking-wide text-muted-foreground">Added</dt>
              <dd>{formatDate(photo.consentAt)}</dd>
              <dt className="text-xs font-medium tracking-wide text-muted-foreground">Kept until</dt>
              <dd>{photo.status === "active" ? `${formatDate(photo.expiresAt)}, unless you remove it sooner` : "—"}</dd>
              <dt className="text-xs font-medium tracking-wide text-muted-foreground">Terms</dt>
              <dd>
                <Mono upper={false}>v{photo.consentVersion}</Mono>
                {!photo.consentCurrent ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    the terms have changed since this photograph was added
                  </span>
                ) : null}
              </dd>
            </dl>
            {photo.status === "active" ? (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <ConfirmDialog
                  trigger={
                    <Button variant="destructive" className="h-11 rounded-none px-5">
                      Remove photograph
                    </Button>
                  }
                  title="Remove your photograph?"
                  description={REMOVE_PHOTO_WORDS}
                  confirmLabel="Remove photograph"
                  destructive
                  onConfirm={() => remove({ ...guestKeyArg, photoId: photo.photoId })}
                />
                <Button
                  variant="outline"
                  className="h-11 rounded-none px-5"
                  onClick={() => void requestRecord()}
                  disabled={requesting}
                  aria-busy={requesting}
                >
                  {requesting ? <Spinner data-icon="inline-start" aria-label="Sending your request" /> : null}
                  {requesting ? "Requesting…" : "Request a removal record"}
                </Button>
              </div>
            ) : null}
            <p className="max-w-2xl text-xs leading-relaxed text-pretty text-muted-foreground">
              &ldquo;{PRIVACY_KIND_LABELS.delete_photos}&rdquo; runs the removal as recorded steps — preview links
              revoked, preview jobs cancelled, photographs and results deleted, the preview provider told — and
              discloses what the house cannot confirm from here. {RECORDED_STEPS_SENTENCE}
            </p>
            {failure ? (
              <ErrorAlert
                title="Could not open the removal request"
                message={failure.message}
                onRetry={() => {
                  privacy.clearFailure();
                  void requestRecord();
                }}
              />
            ) : null}
          </div>
        </div>
      )}
    </AtelierSection>
  );
}
