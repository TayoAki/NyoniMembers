"use client";

import { useAtelierSession } from "@/components/atelier/shell/atelier-session";
import { useAtelierViewer } from "@/hooks/atelier/use-atelier-viewer";

/**
 * Arguments for a Convex read of something the visitor owns: the browser's guest key, or nothing
 * for a signed-in client (the server resolves the account). Returns "skip" until the session has
 * read storage and the backend knows who is asking, so a query never fires with the wrong identity:
 * a signed-in client's request, commission or fitting is never answered "not found" on first paint.
 */
export function useOwnerArgs<T extends Record<string, unknown>>(
  extra: T,
  enabled = true,
): (T & { guestKey?: string }) | "skip" {
  const { guestKey, ready } = useAtelierSession();
  const { authSettled } = useAtelierViewer();
  if (!ready || !authSettled || !enabled) return "skip";
  return guestKey ? { ...extra, guestKey } : extra;
}

/** The same key for mutations, which take the guest key as a plain optional argument. */
export function useGuestKeyArg(): { guestKey?: string } {
  const { guestKey } = useAtelierSession();
  return guestKey ? { guestKey } : {};
}
