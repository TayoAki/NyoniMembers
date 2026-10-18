/**
 * The browser-side index of a guest's drafts and the guest key itself. Storage can be blocked (private
 * windows, cleared data); every read and write is guarded and the caller is told whether storage held.
 */
export const GUEST_KEY_STORAGE = "nyoni.atelier.guest";
export const DRAFT_INDEX_STORAGE = "nyoni.atelier.drafts";
export const DRAFT_INDEX_LIMIT = 20;

export type LocalDraftEntry = { draftId: string; name: string; updatedAt: number };

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const probe = "__nyoni_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function storageAvailable(): boolean {
  return storage() !== null;
}

export function mintGuestKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function readGuestKey(): string | null {
  const store = storage();
  if (!store) return null;
  const value = store.getItem(GUEST_KEY_STORAGE);
  return value && /^[a-f0-9]{32}$/.test(value) ? value : null;
}

export function writeGuestKey(key: string): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(GUEST_KEY_STORAGE, key);
    return true;
  } catch {
    return false;
  }
}

export function readDraftIndex(): LocalDraftEntry[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(DRAFT_INDEX_STORAGE);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is LocalDraftEntry =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as LocalDraftEntry).draftId === "string" &&
          typeof (entry as LocalDraftEntry).name === "string" &&
          typeof (entry as LocalDraftEntry).updatedAt === "number",
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function writeDraftIndex(entries: LocalDraftEntry[]): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(DRAFT_INDEX_STORAGE, JSON.stringify(entries.slice(0, DRAFT_INDEX_LIMIT)));
    return true;
  } catch {
    return false;
  }
}

export function upsertDraftEntry(entries: LocalDraftEntry[], entry: LocalDraftEntry): LocalDraftEntry[] {
  const rest = entries.filter((existing) => existing.draftId !== entry.draftId);
  return [entry, ...rest].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, DRAFT_INDEX_LIMIT);
}
