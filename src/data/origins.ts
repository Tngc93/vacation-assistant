/**
 * Departure cities: any city with an airport open to flights (Berk, 2026-10-29). The list itself
 * (src/data/origins.json, ~3,500 cities) is server-only and read through src/lib/origins/data.ts; this module holds
 * only what the browser needs to know without it.
 */

/** IATA metropolitan code (IST, LON) or a one-airport city's airport code (ESB for Ankara). A link may carry another airport's code (SAW); the server maps it to its city. */
export type OriginCode = string;

/** İstanbul (IST + SAW), when a link names no origin or one we do not know. Never written to the URL. */
export const DEFAULT_ORIGIN: OriginCode = "IST";

export type OriginAirport = { code: string; name: string };

/** A departure city as the server resolves it, named in one interface language. Plain data, for client components. */
export type Origin = {
  code: OriginCode;
  /** The name in the interface language ("Londra" / "London", "Münih" / "Munich"). */
  name: string;
  country: string;
  /** The country in the interface language ("Birleşik Krallık" / "United Kingdom"). */
  countryName: string;
  timeZone: string;
  airports: OriginAirport[];
};

/** One row of the origin combobox (`/api/origins?q=`). */
export type OriginOption = Pick<Origin, "code" | "name" | "countryName"> & { airports: string[] };

export function toOriginOption(origin: Origin): OriginOption {
  return { code: origin.code, name: origin.name, countryName: origin.countryName, airports: origin.airports.map((a) => a.code) };
}

/** "IST + SAW" — the airport codes searched for an origin. */
export function originAirportsLabel(origin: Pick<OriginOption, "airports">): string {
  return origin.airports.join(" + ");
}

/**
 * The airports in little room: "IST + SAW" up to three, "LON · 6 HAVALİMANI" ("LON · 6 AIRPORTS") beyond (London,
 * Moscow, Chicago); `count` words the number in the interface language.
 */
export function originAirportsShort(origin: Pick<OriginOption, "code" | "airports">, count: (n: number) => string): string {
  return origin.airports.length <= 3 ? originAirportsLabel(origin) : `${origin.code} · ${count(origin.airports.length)}`;
}

/** The browser remembers the last origin chosen (localStorage; per visitor, never sent anywhere but in `?from=`). */
export const ORIGIN_STORAGE_KEY = "va.origin";

const CODE = /^[A-Z]{3}$/;

function isOption(value: unknown): value is OriginOption {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.code === "string" &&
    CODE.test(v.code) &&
    typeof v.name === "string" &&
    // `countryTr`: remembered before the English interface (2026-10-29).
    (typeof v.countryName === "string" || typeof v.countryTr === "string") &&
    Array.isArray(v.airports) &&
    v.airports.every((a) => typeof a === "string" && CODE.test(a))
  );
}

/** The remembered origin, or null when there is none or storage cannot be read (private mode, blocked, bad JSON). */
export function readRememberedOrigin(): OriginOption | null {
  try {
    const raw = window.localStorage.getItem(ORIGIN_STORAGE_KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (!isOption(value)) return null;
    const { countryTr, ...rest } = value as OriginOption & { countryTr?: string };
    return { ...rest, countryName: rest.countryName ?? countryTr ?? "" };
  } catch {
    return null;
  }
}

/** Remembers a chosen origin; İstanbul, the default, is remembered by forgetting. */
export function rememberOrigin(origin: OriginOption): void {
  try {
    if (origin.code === DEFAULT_ORIGIN) window.localStorage.removeItem(ORIGIN_STORAGE_KEY);
    else window.localStorage.setItem(ORIGIN_STORAGE_KEY, JSON.stringify(origin));
  } catch {
    // Storage blocked: the choice still applies to this plan through the URL.
  }
}
