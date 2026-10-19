"use client";

import { ErrorAlert } from "@/components/common/error-alert";
import { toClientError } from "@/lib/errors";

export default function RequestsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-lg py-12">
      <ErrorAlert
        title="Your requests could not be loaded"
        message={`${toClientError(error).message} Nothing you sent the house is lost.`}
        onRetry={reset}
        retryLabel="Try again"
      />
    </div>
  );
}
