"use client";

import { useAuth } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";
import { useEffect, useState } from "react";

export type ViewerStatus = "loading" | "signed_in" | "signed_out";

/** How long the account check may stay unknown before a screen falls back to its signed-out words. */
const GRACE_MS = 4000;

/**
 * Who is looking: a signed-in client or a guest. Screens that need an account (membership, linking)
 * branch on `status`; everything else works for both. `convexReady` says whether the backend already
 * holds the account's token, which an account-only mutation needs. When the sign-in service cannot be
 * reached the status settles on "signed_out" after a short grace so no screen waits forever.
 */
export function useAtelierViewer(): { status: ViewerStatus; convexReady: boolean } {
  const { isLoaded, isSignedIn } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const [graceOver, setGraceOver] = useState(false);

  useEffect(() => {
    if (isLoaded) return;
    const timer = window.setTimeout(() => setGraceOver(true), GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [isLoaded]);

  const status: ViewerStatus = isLoaded
    ? isSignedIn
      ? "signed_in"
      : "signed_out"
    : graceOver
      ? "signed_out"
      : "loading";
  return { status, convexReady: isAuthenticated };
}
