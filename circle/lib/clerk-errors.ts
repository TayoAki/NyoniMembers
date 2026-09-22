import { isClerkAPIResponseError } from "@clerk/clerk-expo";

/**
 * Clerk answers with a list of errors, each with a long message and a short one. The short one is
 * what a member should read; the list's first entry is the one that stopped them.
 */
export function clerkMessage(error: unknown, fallback: string): string {
  if (isClerkAPIResponseError(error)) {
    const first = error.errors[0];
    if (first) return first.longMessage ?? first.message ?? fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
