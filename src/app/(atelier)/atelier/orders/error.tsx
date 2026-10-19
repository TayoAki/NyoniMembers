"use client";

import { ErrorAlert } from "@/components/common/error-alert";
import { toClientError } from "@/lib/errors";

export default function OrdersError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto w-full max-w-lg py-12">
      <ErrorAlert
        title="Your commissions could not be loaded"
        message={`${toClientError(error).message} Nothing about your commissions has changed on the house's side.`}
        onRetry={reset}
        retryLabel="Try again"
      />
    </div>
  );
}
