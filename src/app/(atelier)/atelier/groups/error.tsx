"use client";

import { ErrorAlert } from "@/components/common/error-alert";
import { toClientError } from "@/lib/errors";

export default function GroupsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-lg py-12">
      <ErrorAlert
        title="The group could not be shown"
        message={toClientError(error).message}
        onRetry={reset}
        retryLabel="Reload"
      />
    </div>
  );
}
