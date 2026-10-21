import type { RateTable } from "@/lib/ai/webPrices";
import { COMMON_CURRENCIES } from "@/lib/ai/webPrices";
import { getRate } from "./index";

/**
 * TRY rates for the currencies a web-search price is likely to be in (the destination's own, EUR, USD, GBP),
 * for client components. A currency whose rate could not be fetched is left out: no lira amount, never a guess.
 */
export async function loadRateTable(localCurrency: string): Promise<RateTable> {
  const currencies = [...new Set([localCurrency, ...COMMON_CURRENCIES])].filter((c) => c !== "TRY");
  const results = await Promise.all(currencies.map((c) => getRate(c)));
  const table: RateTable = {};
  for (const r of results) if (r.ok) table[r.currency] = { tryPerUnit: r.tryPerUnit, sourceName: r.source.name, date: r.date };
  return table;
}
