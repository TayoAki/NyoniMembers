"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

export type CurrentUser = NonNullable<FunctionReturnType<typeof api.users.me>>;

/**
 * The signed-in user with their live balance.
 * `isLoading` covers both Clerk bootstrapping and the first Convex round-trip.
 */
export function useCurrentUser(): { user: CurrentUser | null; isLoading: boolean; isAuthenticated: boolean } {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const user = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const isLoading = authLoading || (isAuthenticated && user === undefined);
  return { user: user ?? null, isLoading, isAuthenticated };
}
