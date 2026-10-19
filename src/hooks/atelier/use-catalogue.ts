"use client";

import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "@convex/_generated/api";
import type { CatalogueEntryView } from "@convex/atelier/views";
import type { StudioCatalogue } from "@/components/atelier/studio/panel-contract";

/** The approved cloths, buttons and linings the studio offers; undefined until all three have arrived. */
export function useStudioCatalogue(): StudioCatalogue | undefined {
  const cloths = useQuery(api.atelier.catalogue.list, { kind: "cloth" });
  const buttons = useQuery(api.atelier.catalogue.list, { kind: "button" });
  const linings = useQuery(api.atelier.catalogue.list, { kind: "lining" });
  return useMemo(
    () => (cloths && buttons && linings ? { cloths, buttons, linings } : undefined),
    [cloths, buttons, linings],
  );
}

export function findCatalogueEntry(
  entries: CatalogueEntryView[] | undefined,
  code: string | null | undefined,
): CatalogueEntryView | null {
  if (!entries || !code) return null;
  return entries.find((entry) => entry.code === code) ?? null;
}
