"use client";

import { ErrorAlert } from "@/components/common/error-alert";
import { toClientError } from "@/lib/errors";

export default function PrivacyError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-lg py-12">
      <ErrorAlert
        title="Your privacy controls could not be shown"
        message={toClientError(error).message}
        onRetry={reset}
        retryLabel="Reload"
      />
    </div>
  );
}
