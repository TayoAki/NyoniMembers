"use client";

import { useAction, usePaginatedQuery, type UsePaginatedQueryResult } from "convex/react";
import { useCallback, useState } from "react";
import { reportError } from "@/lib/errors";
import { api } from "@convex/_generated/api";
import type { PackId } from "@convex/shared/credits";
import type { FunctionReturnType } from "convex/server";

export type LedgerLine = FunctionReturnType<typeof api.credits.ledger>["page"][number];

export type PackCheckout = {
  /** Creates a Stripe Checkout session and sends the browser to it. */
  buy: (packId: PackId) => Promise<void>;
  /** The pack whose session is being created, so only its button spins. */
  pendingPackId: PackId | null;
};

export function usePackCheckout(): PackCheckout {
  const createPackCheckout = useAction(api.billing.createPackCheckout);
  const [pendingPackId, setPendingPackId] = useState<PackId | null>(null);

  const buy = useCallback(
    async (packId: PackId) => {
      setPendingPackId(packId);
      try {
        const { url } = await createPackCheckout({ packId });
        // Stays pending on success: the tab is navigating away, so the button must not come back to life.
        window.location.assign(url);
      } catch (error) {
        setPendingPackId(null);
        reportError(error, "Could not start checkout.");
      }
    },
    [createPackCheckout],
  );

  return { buy, pendingPackId };
}

export const LEDGER_PAGE_SIZE = 25;

/** Newest-first credit ledger for the signed-in user, paginated. */
export function useLedger(initialNumItems: number = LEDGER_PAGE_SIZE): UsePaginatedQueryResult<LedgerLine> {
  return usePaginatedQuery(api.credits.ledger, {}, { initialNumItems });
}
