import "server-only";
import { externalFetch, timeoutSignal } from "@/lib/net";
import { reasonForStatus, type FlightsErrorReason } from "./errors";
import { pricesUrl, type PricesQuery } from "./params";
import { parsePricesResponse, type ApiTicket } from "./schema";

export const FLIGHTS_TIMEOUT_MS = 4_000;
/** Next.js data cache lifetime for price requests: one hour. */
export const FLIGHTS_REVALIDATE_SECONDS = 60 * 60;

export type Fetcher = (url: string, init: RequestInit & { next?: { revalidate?: number } }) => Promise<Response>;

export type FetchOutcome = { ok: true; tickets: ApiTicket[] } | { ok: false; reason: FlightsErrorReason };

/**
 * Server-only settings. The token never leaves this module except as a
 * request header to api.travelpayouts.com; the marker is public (it is part
 * of every partner link).
 */
export function flightsConfig(): { token: string | null; marker: string | null } {
  const token = process.env.TRAVELPAYOUTS_TOKEN?.trim() || null;
  const marker = process.env.TRAVELPAYOUTS_MARKER?.trim() || null;
  return { token, marker: marker && /^\d+$/.test(marker) ? marker : null };
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
