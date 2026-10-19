"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { DraftView } from "@convex/atelier/drafts";
import { useOwnerArgs } from "./use-owner-args";

export type DraftState =
  { status: "loading"; draft: undefined } | { status: "missing"; draft: null } | { status: "ready"; draft: DraftView };

/** A Convex document id as the URL carries it; anything else is answered as missing without a round trip. */
export function looksLikeDraftId(value: string): boolean {
  return /^[a-z0-9]{20,64}$/.test(value);
}

/**
 * The studio's one read of the design. Loading until the session knows who the visitor is and the
 * server has answered; missing for a malformed, unknown or foreign id (the server answers null for
 * all three, so a guest never learns whether a draft exists).
 */
export function useDraft(draftId: string): DraftState {
  const valid = looksLikeDraftId(draftId);
  const args = useOwnerArgs({ draftId }, valid);
  const draft = useQuery(api.atelier.drafts.get, args);
  if (!valid) return { status: "missing", draft: null };
  if (draft === undefined) return { status: "loading", draft: undefined };
  if (draft === null) return { status: "missing", draft: null };
  return { status: "ready", draft };
}
