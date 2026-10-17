import "server-only";
import { externalFetch, timeoutSignal } from "@/lib/net";
import { reasonForStatus, type FlightsErrorReason } from "./errors";
import type { Partner } from "./links";
import { pricesUrl, type PricesQuery } from "./params";
import { parsePricesResponse, type ApiTicket } from "./schema";

export const FLIGHTS_TIMEOUT_MS = 4_000;
/** Next.js data cache lifetime for price requests: one hour. */
export const FLIGHTS_REVALIDATE_SECONDS = 60 * 60;

export type Fetcher = (url: string, init: RequestInit & { next?: { revalidate?: number } }) => Promise<Response>;

export type FetchOutcome = { ok: true; tickets: ApiTicket[] } | { ok: false; reason: FlightsErrorReason };

/**
 * Server-only settings. The token never leaves this module except as a
 * request header to api.travelpayouts.com; the marker and the project id
 * (trs) are public, they are part of every partner link.
 */
export function flightsConfig(): { token: string | null; partner: Partner } {
  const read = (name: string) => process.env[name]?.trim() || null;
  const numeric = (value: string | null) => (value && /^\d+$/.test(value) ? value : null);
  return {
    token: read("TRAVELPAYOUTS_TOKEN"),
    partner: { marker: numeric(read("TRAVELPAYOUTS_MARKER")), trs: numeric(read("TRAVELPAYOUTS_PROJECT_ID")) },
  };
}

/** One `prices_for_dates` request. Never throws; failures come back as a reason. */
export async function fetchPrices(
  query: PricesQuery,
  { token, fetcher = externalFetch, timeoutMs = FLIGHTS_TIMEOUT_MS }: { token: string; fetcher?: Fetcher; timeoutMs?: number },
): Promise<FetchOutcome> {
  let res: Response;
  try {
    res = await fetcher(pricesUrl(query), {
      headers: { "X-Access-Token": token, Accept: "application/json", "Accept-Encoding": "gzip, deflate" },
      signal: timeoutSignal(timeoutMs),
      next: { revalidate: FLIGHTS_REVALIDATE_SECONDS },
    });
  } catch (error) {
    const name = typeof error === "object" && error !== null && "name" in error ? String(error.name) : "";
    return { ok: false, reason: name === "TimeoutError" || name === "AbortError" ? "timeout" : "unavailable" };
  }
  const reason = reasonForStatus(res.status);
  if (reason) return { ok: false, reason };
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  const parsed = parsePricesResponse(json);
  return parsed.ok ? { ok: true, tickets: parsed.tickets } : { ok: false, reason: "unavailable" };
}
