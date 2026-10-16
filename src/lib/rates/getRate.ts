import { parseErApi, parseFrankfurter, parseTcmbXml } from "./parse";
import { SOURCES, type Fetcher, type RateResult, type RateSourceId } from "./types";

export const RATE_TIMEOUT_MS = 4_000;
/** Next.js data cache lifetime for every rate request (about 6 hours). */
export const RATE_REVALIDATE_SECONDS = 6 * 60 * 60;

export type RateOptions = { fetcher?: Fetcher; timeoutMs?: number };

type Provider = {
  id: RateSourceId;
  load: (currency: string, get: (url: string) => Promise<Response>) => Promise<{ date: string; tryPerUnit: number } | null>;
};

// Order matters: the central bank first, then ECB data, then the broad fallback.
const PROVIDERS: Provider[] = [
  {
    id: "tcmb",
    async load(currency, get) {
      const parsed = parseTcmbXml(await (await get(SOURCES.tcmb.url)).text());
      const rate = parsed.tryPerUnit[currency];
      return rate ? { date: parsed.date, tryPerUnit: rate } : null;
    },
  },
  {
    id: "frankfurter",
    async load(currency, get) {
      const res = await get(`https://api.frankfurter.dev/v1/latest?base=${currency}&symbols=TRY`);
      // Frankfurter answers 404 for currencies the ECB does not publish.
      if (res.status === 404) return null;
      return parseFrankfurter(await res.json(), currency);
    },
  },
  {
    id: "erapi",
    async load(currency, get) {
      const res = await get(`https://open.er-api.com/v6/latest/${currency}`);
      const json = (await res.json()) as { result?: string; "error-type"?: string };
      if (json?.result === "error" && json["error-type"] === "unsupported-code") return null;
      return parseErApi(json, currency);
    },
  },
];

function reasonOf(error: unknown): string {
  // Checked by name: the DOMException may come from another realm (undici, jsdom).
  const name = typeof error === "object" && error !== null && "name" in error ? String(error.name) : "";
  if (name === "TimeoutError" || name === "AbortError") return "timeout";
  return error instanceof Error ? error.message : String(error);
}

/**
 * Price of one unit of `currency` in TRY, from the first source that has it.
 * Never throws and never invents a rate: if every source fails or lacks the
 * currency, the result says so.
 */
export async function getTryRate(currency: string, options: RateOptions = {}): Promise<RateResult> {
  const code = currency.toUpperCase();
  const fetcher: Fetcher = options.fetcher ?? ((url, init) => fetch(url, init));
  const timeoutMs = options.timeoutMs ?? RATE_TIMEOUT_MS;
  const attempts: Array<{ source: RateSourceId; reason: string }> = [];

  if (!/^[A-Z]{3}$/.test(code)) return { ok: false, currency: code, attempts: [] };

  const get = async (url: string) => {
    const res = await fetcher(url, {
      signal: AbortSignal.timeout(timeoutMs),
      next: { revalidate: RATE_REVALIDATE_SECONDS },
    });
    if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
    return res;
  };

  for (const provider of PROVIDERS) {
    try {
      const found = await provider.load(code, get);
      if (found) return { ok: true, currency: code, tryPerUnit: found.tryPerUnit, source: SOURCES[provider.id], date: found.date };
      attempts.push({ source: provider.id, reason: "currency not published" });
    } catch (error) {
      attempts.push({ source: provider.id, reason: reasonOf(error) });
    }
  }
  return { ok: false, currency: code, attempts };
}
