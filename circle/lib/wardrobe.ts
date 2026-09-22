import { useQuery } from "convex/react";
import { isBackendLive } from "./config";
import { api, type ItemView } from "./convex";
import { pieces as fixturePieces } from "./fixtures";
import type { Category } from "./types";

/**
 * The member's own pieces, from wherever this build reads them. One shape, so the wardrobe screens
 * cannot tell whether they are looking at the fixtures or at the rows the web app writes.
 */
export type WardrobePiece = {
  id: string;
  name: string;
  category: Category;
  subcategory: string;
  colour: string;
  /** Photographed by the member, or part of the house's capsule. */
  source: "owned" | "purchased" | "house";
  /** A bundled photograph, keyed into `lib/images.ts`. Fixtures only. */
  imageKey?: string;
  /** A signed URL, null while the cutout is still being extracted. The house's deployment only. */
  uri?: string | null;
  /** What the member paid, where the house knows it. Not something the wardrobe rows carry yet. */
  costUsd?: number;
  size?: string;
  wearCount: number;
  addedAt: number;
};

export type Wardrobe = {
  pieces: WardrobePiece[];
  /** True on the first read. The screen shows skeletons, never an empty state it would have to take back. */
  isLoading: boolean;
};

function fromItem(item: ItemView): WardrobePiece {
  return {
    id: item._id,
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    colour: item.colours[0] ?? "",
    // The capsule seeder stamps every piece it inserts with the house's name.
    source: item.brand === "Nyoni Couture" ? "house" : "owned",
    uri: item.url,
    wearCount: item.wearCount,
    addedAt: item.createdAt,
  };
}

function useFixtureWardrobe(): Wardrobe {
  return {
    pieces: fixturePieces.map((piece) => ({
      id: piece.id,
      name: piece.name,
      category: piece.category,
      subcategory: piece.subcategory,
      colour: piece.colour,
      source: piece.source,
      imageKey: piece.productId,
      costUsd: piece.costUsd,
      size: piece.size,
      wearCount: piece.wearCount,
      addedAt: piece.addedAt,
    })),
    isLoading: false,
  };
}

function useHouseWardrobe(): Wardrobe {
  const items = useQuery(api.items.list, { status: "ready" });
  return { pieces: (items ?? []).map(fromItem), isLoading: items === undefined };
}

/**
 * Bound once, from what the bundle was built with, so the hooks called are fixed for the life of
 * the app — `useQuery` is never reached in a build with no Convex provider above it.
 */
export const useWardrobe: () => Wardrobe = isBackendLive ? useHouseWardrobe : useFixtureWardrobe;

/**
 * One piece by id, from the same list. A wardrobe is small enough that the house's own query says
 * to filter it on the client, so this costs no extra round trip.
 */
export function useWardrobePiece(id: string | undefined): { piece: WardrobePiece | null; isLoading: boolean } {
  const { pieces, isLoading } = useWardrobe();
  if (isLoading) return { piece: null, isLoading: true };
  return { piece: pieces.find((piece) => piece.id === id) ?? null, isLoading: false };
}
