"use client";

import { ErrorAlert } from "@/components/common/error-alert";
import { toClientError } from "@/lib/errors";

export default function MembershipError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto w-full max-w-lg py-12">
      <ErrorAlert
        title="Your membership could not be checked"
        message={`${toClientError(error).message} Your membership is unchanged; your concierge can confirm it with you.`}
        onRetry={retry}
        retryLabel="Try again"
      />
    </div>
  );
}
