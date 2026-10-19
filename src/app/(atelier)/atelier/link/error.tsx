"use client";

import { ErrorAlert } from "@/components/common/error-alert";
import { toClientError } from "@/lib/errors";

export default function LinkError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto w-full max-w-lg py-12">
      <ErrorAlert
        title="Your designs could not be prepared for saving"
        message={`${toClientError(error).message} Nothing has moved: each design is still saved where it was.`}
        onRetry={retry}
        retryLabel="Try again"
      />
    </div>
  );
}
