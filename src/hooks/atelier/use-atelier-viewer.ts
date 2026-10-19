"use client";

import { useAuth } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";
import { useSyncExternalStore } from "react";

export type ViewerStatus = "loading" | "signed_in" | "signed_out";

/** How long the account check may stay unknown before a screen falls back to its signed-out words. */
const GRACE_MS = 4000;

/*
 * One grace period per page load, not per component: a screen mounted after the sign-in service has
 * already failed to answer for GRACE_MS reads "signed_out" at once instead of waiting again.
 */
let graceOver = false;
let graceTimer: number | null = null;
const graceListeners = new Set<() => void>();

function subscribeGrace(listener: () => void): () => void {
  graceListeners.add(listener);
  if (!graceOver && graceTimer === null) {
    graceTimer = window.setTimeout(() => {
      graceOver = true;
      for (const notify of graceListeners) notify();
    }, GRACE_MS);
  }
  return () => {
    graceListeners.delete(listener);
  };
}

const graceSnapshot = () => graceOver;
const graceServerSnapshot = () => false;

export type AtelierViewer = {
  status: ViewerStatus;
  /** The backend already holds the account's token, which an account-only mutation needs. */
  convexReady: boolean;
  /**
   * The backend knows who is asking: signed in with the token accepted (or refused), signed out, or the
   * sign-in service unreachable past the grace. An owned read waits for this, so a signed-in client's
   * first query never goes out with only the browser's key and answers "not found" for their own work.
   */
  authSettled: boolean;
};

/**
 * Who is looking: a signed-in client or a guest. Screens that need an account (membership, linking)
 * branch on `status`; everything else works for both. When the sign-in service cannot be reached the
 * status settles on "signed_out" after a short grace so no screen waits forever.
 */
export function useAtelierViewer(): AtelierViewer {
  const { isLoaded, isSignedIn } = useAuth();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const graceElapsed = useSyncExternalStore(subscribeGrace, graceSnapshot, graceServerSnapshot);

  const status: ViewerStatus = isLoaded
    ? isSignedIn
      ? "signed_in"
      : "signed_out"
    : graceElapsed
      ? "signed_out"
      : "loading";
  const authSettled = !isLoading || (!isLoaded && graceElapsed);
  return { status, convexReady: isAuthenticated, authSettled };
}
