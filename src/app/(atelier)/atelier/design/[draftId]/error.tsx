"use client";

import { ErrorAlert } from "@/components/common/error-alert";
import { toClientError } from "@/lib/errors";

/** Shown inside the studio frame, so the stage and the rail stay while the panel recovers. */
export default function DesignError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="py-2">
      <ErrorAlert
        title="The studio hit a problem"
        message={`${toClientError(error).message} Your design is saved as it last was; nothing here changed it.`}
        onRetry={reset}
        retryLabel="Reload this step"
        className="rounded-sm"
      />
    </div>
  );
}
