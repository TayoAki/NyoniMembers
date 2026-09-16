"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { guardMutation, type ErrorSink } from "@/lib/errors";
import { routes } from "@/lib/routes";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

export type Render = FunctionReturnType<typeof api.renders.listByOutfit>[number];
export type RenderDetail = NonNullable<FunctionReturnType<typeof api.renders.get>>;
export type Avatar = FunctionReturnType<typeof api.avatars.list>[number];
export type StartRendersArgs = FunctionArgs<typeof api.renders.start>;
export type StartRendersResult = FunctionReturnType<typeof api.renders.start>;

export function useRendersForOutfit(outfitId: Id<"outfits"> | null | undefined): Render[] | undefined {
  return useQuery(api.renders.listByOutfit, outfitId ? { outfitId } : "skip");
}

/** Render plus the outfit it came from — used by the lightbox so the collage needs no second query. */
export function useRender(renderId: Id<"renders"> | null | undefined): RenderDetail | null | undefined {
  return useQuery(api.renders.get, renderId ? { renderId } : "skip");
}

export function useAvatars(): Avatar[] | undefined {
  const { isAuthenticated } = useConvexAuth();
  return useQuery(api.avatars.list, isAuthenticated ? {} : "skip");
}

export type RenderActions = {
  start: (args: StartRendersArgs, onError?: ErrorSink) => Promise<StartRendersResult | undefined>;
  regenerate: (
    renderId: Id<"renders">,
    onError?: ErrorSink,
  ) => Promise<{ jobId: Id<"jobs">; renderId: Id<"renders"> } | undefined>;
  /** Shares the render, copies the public link and toasts. Resolves to the link, or `undefined` on failure. */
  shareAndCopy: (renderId: Id<"renders">, onError?: ErrorSink) => Promise<string | undefined>;
  copyShareLink: (token: string) => Promise<void>;
  unshare: (renderId: Id<"renders">, onError?: ErrorSink) => Promise<null | undefined>;
  remove: (renderId: Id<"renders">, onError?: ErrorSink) => Promise<null | undefined>;
};

/** Every render mutation, already wrapped so components never repeat try/catch + toast. */
export function useRenderActions(): RenderActions {
  const start = useMutation(api.renders.start);
  const regenerate = useMutation(api.renders.regenerate);
  const share = useMutation(api.renders.share);
  const unshare = useMutation(api.renders.unshare);
  const remove = useMutation(api.renders.remove);

  return useMemo<RenderActions>(
    () => ({
      start: (args, onError) => guardMutation(() => start(args), onError),
      regenerate: (renderId, onError) => guardMutation(() => regenerate({ renderId }), onError),
      shareAndCopy: async (renderId, onError) => {
        const result = await guardMutation(() => share({ renderId }), onError);
        if (!result) return undefined;
        return announceShareLink(result.token);
      },
      copyShareLink: async (token) => {
        await announceShareLink(token);
      },
      unshare: (renderId, onError) => guardMutation(() => unshare({ renderId }), onError),
      remove: (renderId, onError) => guardMutation(() => remove({ renderId }), onError),
    }),
    [start, regenerate, share, unshare, remove],
  );
}

export function shareUrl(token: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}${routes.share(token)}`;
}

async function announceShareLink(token: string): Promise<string> {
  const url = shareUrl(token);
  const copied = await writeToClipboard(url);
  if (copied) toast.success("Share link copied to clipboard.");
  else toast.success("Share link ready.", { description: url });
  return url;
}

async function writeToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * One shared one-second clock for every waiting tile, so a page full of pending renders
 * runs a single interval instead of one each.
 */
let clock = Date.now();
const clockListeners = new Set<() => void>();
let clockTimer: number | null = null;

function subscribeToClock(onChange: () => void): () => void {
  clockListeners.add(onChange);
  clock = Date.now();
  if (clockTimer === null) {
    clockTimer = window.setInterval(() => {
      clock = Date.now();
      for (const listener of clockListeners) listener();
    }, 1000);
  }
  return () => {
    clockListeners.delete(onChange);
    if (clockListeners.size === 0 && clockTimer !== null) {
      window.clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

const getClock = () => clock;

/** Milliseconds since `since`, ticking once a second. Renders 0 on the server so hydration matches. */
export function useElapsed(since: number): number {
  const now = useSyncExternalStore(subscribeToClock, getClock, () => since);
  return Math.max(0, now - since);
}
