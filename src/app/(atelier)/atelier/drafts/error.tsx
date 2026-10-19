"use client";

import { ErrorAlert } from "@/components/common/error-alert";
import { toClientError } from "@/lib/errors";

export default function DraftsError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto w-full max-w-lg py-12">
      <ErrorAlert
        title="Your designs could not be loaded"
        message={`${toClientError(error).message} Every design saved to this browser or to your account is as you left it.`}
        onRetry={retry}
        retryLabel="Try again"
      />
    </div>
  );
}
