"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { Category, ItemStatus } from "@convex/shared/wardrobe";
import type { FunctionReturnType } from "convex/server";

export type Item = FunctionReturnType<typeof api.items.list>[number];
export type ItemDetail = NonNullable<FunctionReturnType<typeof api.items.get>>;

/** Below this the search index is noise, so the wardrobe falls back to the plain list. */
export const MIN_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 250;

/** Statuses the add-clothes tiles follow while a photo is being ingested. */
const INGEST_STATUSES: readonly ItemStatus[] = ["extracting", "needsCredits", "failed"];

export type WardrobeQuery = {
  /** Raw text from the search box; debounced here so callers can stay dumb. */
  query?: string;
  /** Defaults to the server's `ready` view. Pass `hidden` for the "show hidden" toggle. */
  status?: ItemStatus;
  category?: Category;
};

export type WardrobeResult = {
  items: Item[] | undefined;
  /** True when the list came from the search index rather than the plain list. */
  isSearching: boolean;
  /** True while the typed query has not reached the server yet. */
  isPending: boolean;
};

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);
  return debounced;
}

/**
 * The wardrobe list: full-text search once the query is long enough, otherwise the indexed list.
 * Search has no server-side filters, so status/category are applied here to keep both paths equal.
 */
export function useWardrobe({ query = "", status, category }: WardrobeQuery = {}): WardrobeResult {
  const { isAuthenticated } = useConvexAuth();
  const debouncedQuery = useDebounced(query, SEARCH_DEBOUNCE_MS);
  const trimmed = debouncedQuery.trim();
  const isSearching = trimmed.length >= MIN_SEARCH_LENGTH;

  const listed = useQuery(api.items.list, !isAuthenticated || isSearching ? "skip" : { status, category });
  const found = useQuery(api.items.search, !isAuthenticated || !isSearching ? "skip" : { query: trimmed });

  const items = useMemo(() => {
    if (!isSearching) return listed;
    if (!found) return undefined;
    const wanted = status ?? "ready";
    return found.filter((item) => item.status === wanted && (!category || item.category === category));
  }, [category, found, isSearching, listed, status]);

  return { items, isSearching, isPending: query.trim() !== trimmed };
}

/** Items in one status, e.g. the `needsCredits` queue. */
export function useItemsByStatus(status: ItemStatus, enabled = true): Item[] | undefined {
  const { isAuthenticated } = useConvexAuth();
  return useQuery(api.items.list, isAuthenticated && enabled ? { status } : "skip");
}

export type UploadItems = {
  /** Every item produced by an upload, keyed by `uploadId`, oldest first. */
  byUpload: Map<string, Item[]>;
  isLoading: boolean;
};

/**
 * Items the add-clothes screen watches while photos are ingested: the finished cutouts plus the
 * ones still extracting, waiting on credits or failed. One subscription set for the whole page.
 */
export function useUploadItems(enabled = true): UploadItems {
  const { isAuthenticated } = useConvexAuth();
  const active = isAuthenticated && enabled;
  const ready = useQuery(api.items.list, active ? {} : "skip");
  const extracting = useQuery(api.items.list, active ? { status: INGEST_STATUSES[0] } : "skip");
  const needsCredits = useQuery(api.items.list, active ? { status: INGEST_STATUSES[1] } : "skip");
  const failed = useQuery(api.items.list, active ? { status: INGEST_STATUSES[2] } : "skip");

  return useMemo(() => {
    const byUpload = new Map<string, Item[]>();
    const loaded = [ready, extracting, needsCredits, failed].filter((page): page is Item[] => page !== undefined);
    for (const item of loaded.flat().sort((a, b) => a.createdAt - b.createdAt)) {
      if (!item.uploadId) continue;
      const bucket = byUpload.get(item.uploadId);
      if (bucket) bucket.push(item);
      else byUpload.set(item.uploadId, [item]);
    }
    return { byUpload, isLoading: active && loaded.length < 4 };
  }, [active, extracting, failed, needsCredits, ready]);
}

/** One item with its outfits, source photo and flagged duplicate. `null` means it is gone. */
export function useItem(itemId: Id<"items"> | null | undefined): ItemDetail | null | undefined {
  const { isAuthenticated } = useConvexAuth();
  return useQuery(api.items.get, isAuthenticated && itemId ? { itemId } : "skip");
}

/** Distinct swatches across a list of items, most common first — the wardrobe colour filter. */
export function colourOptions(items: readonly Item[]): Array<{ value: string; hex: string | null; count: number }> {
  const counts = new Map<string, { hex: string | null; count: number }>();
  for (const item of items) {
    const value = item.colours.primary;
    if (!value) continue;
    const existing = counts.get(value);
    if (existing) existing.count += 1;
    else counts.set(value, { hex: item.colours.hex[0] ?? null, count: 1 });
  }
  return [...counts.entries()]
    .map(([value, { hex, count }]) => ({ value, hex, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}
