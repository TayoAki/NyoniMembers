"use client";

import { ErrorAlert } from "@/components/common/error-alert";
import { toClientError } from "@/lib/errors";

export default function OrderError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-lg py-12">
      <ErrorAlert
        title="This commission could not be loaded"
        message={`${toClientError(error).message} The commission itself is unchanged on the house's side.`}
        onRetry={reset}
        retryLabel="Try again"
      />
    </div>
  );
}
