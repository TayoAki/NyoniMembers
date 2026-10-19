"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { LocalDraftEntry } from "@/lib/atelier/local-drafts";
import {
  forgetDraft,
  getServerSnapshot,
  getSnapshot,
  initialize,
  rememberDraft,
  subscribe,
} from "@/lib/atelier/session-store";

export type AtelierSession = {
  /** The bearer key this browser uses for guest-owned rows; null until mounted. */
  guestKey: string | null;
  /** False when the browser refuses storage: drafts live in memory and resume is unavailable (C01, C12). */
  storageAvailable: boolean;
  /** True once the client has read storage; before that, guestKey is unknown rather than absent. */
  ready: boolean;
  draftIndex: LocalDraftEntry[];
  rememberDraft: (entry: LocalDraftEntry) => void;
  forgetDraft: (draftId: string) => void;
};

const AtelierSessionContext = createContext<AtelierSession | null>(null);

/**
 * Mints and remembers the guest key and the local draft index. Lives above every Atelier screen so a
 * guest's work survives navigation and reloads on the same browser, and so screens can tell the truth
 * about what "saved" means.
 */
export function AtelierSessionProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    initialize();
  }, []);

  const value = useMemo<AtelierSession>(
    () => ({
      guestKey: snapshot.guestKey,
      storageAvailable: snapshot.storageAvailable,
      ready: snapshot.ready,
      draftIndex: snapshot.draftIndex,
      rememberDraft,
      forgetDraft,
    }),
    [snapshot],
  );

  return <AtelierSessionContext value={value}>{children}</AtelierSessionContext>;
}

export function useAtelierSession(): AtelierSession {
  const context = useContext(AtelierSessionContext);
  if (!context) throw new Error("useAtelierSession must be used inside <AtelierSessionProvider>.");
  return context;
}
