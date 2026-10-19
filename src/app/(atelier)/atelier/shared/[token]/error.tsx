"use client";

import { ErrorAlert } from "@/components/common/error-alert";

/** The page reads the design on the server, whose error text production hides; the words here say what failed. */
export default function SharedDesignError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto w-full max-w-lg py-12">
      <ErrorAlert
        title="This shared design could not be shown"
        message="The house could not be reached to show it. The link itself is unchanged; try again in a moment."
        onRetry={retry}
        retryLabel="Try again"
      />
    </div>
  );
}
