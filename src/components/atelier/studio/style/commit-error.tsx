"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ErrorAlert } from "@/components/common/error-alert";
import { routes } from "@/lib/routes";
import type { CommitFailure } from "./use-panel-commit";

/**
 * A change that did not reach the server, said plainly with the operation named; the choice the client
 * made is still on screen. A sign-in link when the server asks for an account; retry otherwise.
 */
export function CommitError({
  failure,
  onRetry,
  className,
}: {
  failure: CommitFailure;
  onRetry: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  if (failure.code === "UNAUTHENTICATED") {
    const href = `${routes.signIn}?redirect_url=${encodeURIComponent(pathname)}`;
    return (
      <ErrorAlert
        title="Could not save this change"
        message={
          <>
            {failure.message}{" "}
            <Link href={href} className="underline underline-offset-4">
              Sign in
            </Link>{" "}
            and your design will be here.
          </>
        }
        className={className}
      />
    );
  }
  return (
    <ErrorAlert
      title="Could not save this change"
      message={failure.message}
      onRetry={failure.code === "INVALID_STATE" ? undefined : onRetry}
      className={className}
    />
  );
}
