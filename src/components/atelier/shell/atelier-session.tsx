"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  mintGuestKey,
  readDraftIndex,
  readGuestKey,
  storageAvailable as probeStorage,
  upsertDraftEntry,
  writeDraftIndex,
  writeGuestKey,
  type LocalDraftEntry,
} from "@/lib/atelier/local-drafts";

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
  const [guestKey, setGuestKey] = useState<string | null>(null);
  const [storageOk, setStorageOk] = useState(true);
  const [ready, setReady] = useState(false);
  const [draftIndex, setDraftIndex] = useState<LocalDraftEntry[]>([]);

  useEffect(() => {
    const available = probeStorage();
    setStorageOk(available);
    const existing = readGuestKey();
    const key = existing ?? mintGuestKey();
    if (!existing) writeGuestKey(key);
    setGuestKey(key);
    setDraftIndex(readDraftIndex());
    setReady(true);
  }, []);

  const rememberDraft = useCallback((entry: LocalDraftEntry) => {
    setDraftIndex((current) => {
      const next = upsertDraftEntry(current, entry);
      writeDraftIndex(next);
      return next;
    });
  }, []);

  const forgetDraft = useCallback((draftId: string) => {
    setDraftIndex((current) => {
      const next = current.filter((entry) => entry.draftId !== draftId);
      writeDraftIndex(next);
      return next;
    });
  }, []);

  const value = useMemo<AtelierSession>(
    () => ({ guestKey, storageAvailable: storageOk, ready, draftIndex, rememberDraft, forgetDraft }),
    [guestKey, storageOk, ready, draftIndex, rememberDraft, forgetDraft],
  );

  return <AtelierSessionContext value={value}>{children}</AtelierSessionContext>;
}

export function useAtelierSession(): AtelierSession {
  const context = useContext(AtelierSessionContext);
  if (!context) throw new Error("useAtelierSession must be used inside <AtelierSessionProvider>.");
  return context;
}
