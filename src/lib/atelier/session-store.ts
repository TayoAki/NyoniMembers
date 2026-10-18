import {
  mintGuestKey,
  readDraftIndex,
  readGuestKey,
  storageAvailable as probeStorage,
  upsertDraftEntry,
  writeDraftIndex,
  writeGuestKey,
  type LocalDraftEntry,
} from "./local-drafts";

/**
 * The browser-side Atelier session as an external store, so React reads it with
 * useSyncExternalStore and nothing sets state inside an effect. `initialize()` runs once on the
 * client; the server snapshot is the "not ready" state so first paint matches on both sides.
 */
export type SessionSnapshot = {
  ready: boolean;
  guestKey: string | null;
  storageAvailable: boolean;
  draftIndex: LocalDraftEntry[];
};

const SERVER_SNAPSHOT: SessionSnapshot = { ready: false, guestKey: null, storageAvailable: true, draftIndex: [] };

let snapshot: SessionSnapshot = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();

function emit(next: SessionSnapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): SessionSnapshot {
  return snapshot;
}

export function getServerSnapshot(): SessionSnapshot {
  return SERVER_SNAPSHOT;
}

/**
 * In development only, `?guest=<32 hex>` adopts that guest key for this browser, so a draft seeded
 * from the CLI can be opened for review. Production ignores the parameter.
 */
function adoptedGuestKey(): string | null {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("guest");
  return value && /^[a-f0-9]{32}$/.test(value) ? value : null;
}

/** Reads or mints the guest key and loads the draft index. Safe to call more than once. */
export function initialize(): void {
  if (snapshot.ready) return;
  const available = probeStorage();
  const adopted = adoptedGuestKey();
  const existing = readGuestKey();
  const guestKey = adopted ?? existing ?? mintGuestKey();
  if (guestKey !== existing) writeGuestKey(guestKey);
  emit({ ready: true, guestKey, storageAvailable: available, draftIndex: readDraftIndex() });
}

export function rememberDraft(entry: LocalDraftEntry): void {
  const draftIndex = upsertDraftEntry(snapshot.draftIndex, entry);
  writeDraftIndex(draftIndex);
  emit({ ...snapshot, draftIndex });
}

export function forgetDraft(draftId: string): void {
  const draftIndex = snapshot.draftIndex.filter((entry) => entry.draftId !== draftId);
  writeDraftIndex(draftIndex);
  emit({ ...snapshot, draftIndex });
}
