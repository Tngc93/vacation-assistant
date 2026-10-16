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
