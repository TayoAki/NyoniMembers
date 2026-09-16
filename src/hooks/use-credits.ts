"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { LIMITS } from "@convex/shared/credits";

export type Balance = FunctionReturnType<typeof api.credits.balance>;
export type CreditQuote = FunctionReturnType<typeof api.credits.quote>;
export type QuoteRequest = FunctionArgs<typeof api.credits.quote>["request"];

export function useBalance(): { balance: Balance | undefined; isLow: boolean } {
  const { isAuthenticated } = useConvexAuth();
  const balance = useQuery(api.credits.balance, isAuthenticated ? {} : "skip");
  return { balance, isLow: balance ? balance.total <= LIMITS.lowBalanceThreshold : false };
}

/** Live quote for an action; pass `null` to skip (e.g. while a sheet is closed). */
export function useCreditQuote(request: QuoteRequest | null): CreditQuote | undefined {
  return useQuery(api.credits.quote, request ? { request } : "skip");
}
