import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getTryRate } from "./getRate";
import { SOURCES, type RateResult } from "./types";

/**
 * Sample rates for development and end-to-end tests, which run offline (VA_OFFLINE=1): the saved TCMB
 * bulletin in __fixtures__ (EUR, USD, JPY, KRW; no GBP, so a missing rate shows too). Not today's rates: the
 * source is named "ÖRNEK VERİ (TCMB)" wherever it is shown. Enabled only with VA_RATES_FIXTURES=1 and never
 * on Vercel.
 */
export function rateFixturesEnabled(): boolean {
  return process.env.VA_RATES_FIXTURES === "1" && !process.env.VERCEL;
}

export const SAMPLE_SOURCE_NAME = "ÖRNEK VERİ (TCMB)";

export async function getFixtureRate(currency: string): Promise<RateResult> {
  const xml = readFileSync(path.join(process.cwd(), "src/lib/rates/__fixtures__/tcmb-today.xml"), "utf8");
  const result = await getTryRate(currency, {
    fetcher: async (url) => (url === SOURCES.tcmb.url ? new Response(xml, { status: 200 }) : new Response("{}", { status: 503 })),
  });
  return result.ok ? { ...result, source: { ...result.source, name: SAMPLE_SOURCE_NAME } } : result;
}
