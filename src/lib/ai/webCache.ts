/**
 * Web search results for one search (route + dates + people), kept while the tab is open (sessionStorage), so
 * opening the page again does not spend another search. Never in the URL and never sent anywhere; "Yeniden ara"
 * replaces it. Every read is checked; storage may be blocked, so failures only mean "not cached".
 */
import { z } from "zod";
import type { FlightOffer, StayArea, WebPrices } from "./webPrices";

const PREFIX = "va.web.v1.";

const link = z.object({ url: z.string(), host: z.string() });
const base = {
  dropped: z.number().int().min(0),
  suggestionsHtml: z.string().nullable(),
  source: z.string(),
  searchedAt: z.number(),
  sample: z.boolean(),
};
const minor = z.number().int();
const flights = z.object({
  ...base,
  items: z.array(
    z.object({
      title: z.string(),
      priceMinor: minor,
      currency: z.string(),
      basis: z.enum(["per_person", "total"]),
      link,
      tryPerAdult: minor.nullable(),
    }),
  ),
});
const stays = z.object({
  ...base,
  items: z.array(
    z.object({ name: z.string(), minMinor: minor, maxMinor: minor, currency: z.string(), link, tryMin: minor.nullable(), tryMax: minor.nullable() }),
  ),
});

export type WebKind = "flights" | "stays";
type Stored = { flights: WebPrices<FlightOffer>; stays: WebPrices<StayArea> };
const SCHEMAS = { flights, stays };

/** "flights:IST-BCN-2026-11-14-2026-11-18-2" */
export function webCacheKey(kind: WebKind, parts: readonly (string | number)[]): string {
  return `${PREFIX}${kind}:${parts.join("-")}`;
}

const CHANGED = "va:web-cache";

/** The stored text for a key (a stable snapshot for useSyncExternalStore); null when absent or unreadable. */
export function readWebCacheRaw(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function parseWebCache<K extends WebKind>(kind: K, raw: string | null): Stored[K] | null {
  if (!raw) return null;
  try {
    const parsed = SCHEMAS[kind].safeParse(JSON.parse(raw));
    return parsed.success ? (parsed.data as Stored[K]) : null;
  } catch {
    return null;
  }
}

export function readWebCache<K extends WebKind>(kind: K, key: string): Stored[K] | null {
  return parseWebCache(kind, readWebCacheRaw(key));
}

/** Stores a result and tells subscribers in this tab. Returns false when storage is blocked or full. */
export function writeWebCache<K extends WebKind>(key: string, value: Stored[K]): boolean {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  } finally {
    window.dispatchEvent(new Event(CHANGED));
  }
}

export function subscribeWebCache(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange);
  return () => window.removeEventListener(CHANGED, onChange);
}
