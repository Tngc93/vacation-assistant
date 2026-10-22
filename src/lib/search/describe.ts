import { findDestination } from "@/data/destinations";
import { findOrigin } from "@/data/origins";
import { daysBetween, isoToDate } from "./dates";
import type { SearchState } from "./params";

const dayMonth = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "Europe/Istanbul" });
const day = new Intl.DateTimeFormat("tr-TR", { day: "numeric", timeZone: "Europe/Istanbul" });

/** "14–18 Kas" in one month, "28 Kas – 3 Ara" across months. */
export function formatDateRange(depart: string, ret: string): string {
  if (depart.slice(0, 7) === ret.slice(0, 7)) {
    return `${day.format(isoToDate(depart))}–${dayMonth.format(isoToDate(ret))}`;
  }
  return `${dayMonth.format(isoToDate(depart))} – ${dayMonth.format(isoToDate(ret))}`;
}

/** Page title and meta description for a plan. Assumes a validated search. */
export function describeSearch(state: SearchState): { title: string; description: string } {
  const origin = findOrigin(state.from);
  const destination = findDestination(state.to);
  if (!origin || !destination) return { title: "Plan", description: "Tatil planı" };

  const nights = daysBetween(state.depart, state.return);
  const range = formatDateRange(state.depart, state.return);
  return {
    title: `${origin.nameTr} → ${destination.nameTr} · ${range} · ${state.pax} kişi`,
    description:
      `${origin.nameTr} (${origin.airports.join(", ")}) çıkışlı ${destination.nameTr}, ${destination.countryTr} planı: ` +
      `${range}, ${nights} gece, ${state.pax} kişi. Uçuş, TL bütçe, görülecek yerler ve gün gün plan.`,
  };
}
