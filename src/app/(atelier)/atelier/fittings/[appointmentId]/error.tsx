"use client";

import { ErrorAlert } from "@/components/common/error-alert";
import { toClientError } from "@/lib/errors";

export default function AppointmentError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto w-full max-w-lg py-12">
      <ErrorAlert
        title="This fitting could not be loaded"
        message={`${toClientError(error).message} The appointment itself is unchanged on the house's side.`}
        onRetry={retry}
        retryLabel="Try again"
      />
    </div>
  );
}
