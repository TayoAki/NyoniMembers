"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { ErrorAlert } from "@/components/common/error-alert";
import { ItemImage } from "@/components/common/item-image";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { reportError } from "@/lib/errors";
import { api } from "@convex/_generated/api";
import type { StaffCorrectionView } from "@convex/atelier/corrections";

/**
 * The client's supporting photographs, behind one explicit action. The staff view carries only a count;
 * the URLs come from a mutation that writes `photo.view` to the audit log under the viewer's name, one
 * entry per photograph, and the page says so before the button is pressed (O06, O08).
 */
export function CorrectionPhotos({ correction, operations }: { correction: StaffCorrectionView; operations: boolean }) {
  const reveal = useMutation(api.atelier.corrections.staffPhotoUrls);
  const [urls, setUrls] = useState<string[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (correction.photoCount === 0) return null;

  async function open() {
    setPending(true);
    setError(null);
    try {
      setUrls(await reveal({ correctionId: correction._id }));
    } catch (caught) {
      setError(reportError(caught).message);
    } finally {
      setPending(false);
    }
  }

  if (urls === null) {
    return (
      <div className="mt-2 space-y-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Opening them is recorded in the audit log under your name (<span className="font-mono">photo.view</span>), one
          entry per photograph. They are for this correction only and never leave the house.
        </p>
        {error ? <ErrorAlert title="The photographs did not open" message={error} onRetry={() => void open()} /> : null}
        {operations ? (
          <Button variant="outline" size="sm" disabled={pending} onClick={() => void open()}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            View photographs
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Opening the photographs needs the operations role.</p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <p className="text-xs text-muted-foreground">Recorded in the audit log under your name.</p>
      {urls.length === 0 ? (
        <p className="text-xs text-muted-foreground">These files are gone.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {urls.map((url, index) => (
            <li key={url}>
              <ItemImage
                src={url}
                alt={`Photograph ${index + 1} sent with the correction`}
                variant="photo"
                className="rounded-sm"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
