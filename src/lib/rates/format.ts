import { isoToDate } from "@/lib/search/dates";
import type { RateFound } from "./types";

const amount = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const units = new Intl.NumberFormat("tr-TR");
const shortDate = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "Europe/Istanbul" });

/** Smallest of 1, 100, 1.000, 10.000 units that is worth at least 1 ₺, so small currencies stay readable. */
export function displayUnit(tryPerUnit: number): number {
  return [1, 100, 1_000, 10_000].find((u) => u * tryPerUnit >= 1) ?? 10_000;
}

/** "1 EUR = 55,62 ₺" or "100 JPY = 31,38 ₺". */
export function formatRate(rate: Pick<RateFound, "currency" | "tryPerUnit">): string {
  const unit = displayUnit(rate.tryPerUnit);
  return `${units.format(unit)} ${rate.currency} = ${amount.format(unit * rate.tryPerUnit)} ₺`;
}

/** "1 EUR = 55,62 ₺ · TCMB · 16 Eki" */
export function formatRateLine(rate: RateFound): string {
  return `${formatRate(rate)} · ${rate.source.name} · ${shortDate.format(isoToDate(rate.date))}`;
}

/** Smallest of 1, 100, 1.000, 10.000 units of `from` worth at least one unit of the other currency. */
function crossUnit(perUnit: number): number {
  return [1, 100, 1_000, 10_000].find((u) => u * perUnit >= 1) ?? 10_000;
}

/** "1 EUR = 1,08 USD", "100 JPY = 0,57 EUR", "1 EUR = 55,62 ₺": through TRY, like every conversion here. */
export function formatCrossRate(from: string, fromTryPerUnit: number, to: string, toTryPerUnit: number): string {
  const perUnit = fromTryPerUnit / toTryPerUnit;
  const unit = crossUnit(perUnit);
  return `${units.format(unit)} ${from} = ${amount.format(unit * perUnit)} ${to === "TRY" ? "₺" : to}`;
}

/** "TCMB · 29 Eki"; each source and date once ("TCMB · 29 Eki; Frankfurter (ECB) · 28 Eki"). */
export function formatSourceDates(rates: ReadonlyArray<{ sourceName: string; date: string }>): string {
  return [...new Set(rates.map((r) => `${r.sourceName} · ${shortDate.format(isoToDate(r.date))}`))].join("; ");
}

/** The budget's source line: "Kur: TCMB · 29 Eki". */
export function formatRateSources(rates: ReadonlyArray<{ sourceName: string; date: string }>): string {
  return `Kur: ${formatSourceDates(rates)}`;
}
