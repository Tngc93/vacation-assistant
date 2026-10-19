/**
 * The user's AI connection, kept only in this browser (PRD 24): sessionStorage by default, so it is gone when
 * the tab closes; localStorage only with "Bu cihazda hatırla". Never in the URL, never sent to our server.
 */
import { z } from "zod";
import { PROVIDER_IDS, type Connection } from "./providers";

const STORE_KEY = "va.ai.connection";
const EVENT = "va-ai-connection";

const savedSchema = z.object({
  provider: z.enum(PROVIDER_IDS as [Connection["provider"], ...Connection["provider"][]]),
  key: z.string().min(1).max(500),
  model: z.string().min(1).max(200),
});

export type SavedConnection = Connection & { remember: boolean };

function read(storage: Storage): Connection | null {
  try {
    const raw = storage.getItem(STORE_KEY);
    if (!raw) return null;
    const parsed = savedSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function remove(storage: () => Storage) {
  try {
    storage().removeItem(STORE_KEY);
  } catch {
    // Storage may be blocked (private mode); nothing to remove then.
  }
}

/** Raw JSON of the saved connection, so `useSyncExternalStore` gets a stable snapshot. */
export function connectionSnapshot(): string | null {
  try {
    return window.localStorage.getItem(STORE_KEY) ?? window.sessionStorage.getItem(STORE_KEY);
  } catch {
    return null;
  }
}

export function loadConnection(): SavedConnection | null {
  try {
    const local = read(window.localStorage);
    if (local) return { ...local, remember: true };
    const session = read(window.sessionStorage);
    return session ? { ...session, remember: false } : null;
  } catch {
    return null;
  }
}

/** Saves to one storage and clears the other. Returns false when the browser blocks storage. */
export function saveConnection(conn: Connection, remember: boolean): boolean {
  const value = JSON.stringify({ provider: conn.provider, key: conn.key, model: conn.model });
  try {
    (remember ? window.localStorage : window.sessionStorage).setItem(STORE_KEY, value);
    remove(() => (remember ? window.sessionStorage : window.localStorage));
    window.dispatchEvent(new Event(EVENT));
    return true;
  } catch {
    return false;
  }
}

export function clearConnection(): void {
  remove(() => window.localStorage);
  remove(() => window.sessionStorage);
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeConnection(callback: () => void): () => void {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
