"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { useEffect } from "react";
import { api } from "@convex/_generated/api";

/** Makes sure a `users` row exists as soon as Clerk reports a signed-in session. */
export function StoreUser() {
  const { isAuthenticated } = useConvexAuth();
  const ensure = useMutation(api.users.ensure);
  useEffect(() => {
    if (!isAuthenticated) return;
    void ensure().catch(() => {
      /* transient; the next render's queries will retry through requireUser */
    });
  }, [isAuthenticated, ensure]);
  return null;
}
