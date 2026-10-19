"use client";

import { ErrorAlert } from "@/components/common/error-alert";
import { toClientError } from "@/lib/errors";

export default function AtelierDeskError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-lg py-12">
      <ErrorAlert
        title="The Atelier desk hit a problem"
        message={toClientError(error).message}
        onRetry={reset}
        retryLabel="Reload"
      />
    </div>
  );
}
