import { cityName, countryName, findDestination } from "@/data/destinations";
import type { I18n } from "@/i18n/i18n";
import { findOrigin } from "@/lib/origins/data";
import { daysBetween, isoToDate } from "./dates";
import type { SearchState } from "./params";

const formatters = new Map<string, { dayMonth: Intl.DateTimeFormat; day: Intl.DateTimeFormat }>();
function dateFormatters(intl: string) {
  let f = formatters.get(intl);
  if (!f) {
    f = {
      dayMonth: new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", timeZone: "Europe/Istanbul" }),
      day: new Intl.DateTimeFormat(intl, { day: "numeric", timeZone: "Europe/Istanbul" }),
    };
    formatters.set(intl, f);
  }
  return f;
}

/** "14–18 Kas" in one month, "28 Kas – 3 Ara" across months ("14–18 Nov", "28 Nov – 3 Dec" in English). */
export function formatDateRange(depart: string, ret: string, intl = "tr-TR"): string {
  const { dayMonth, day } = dateFormatters(intl);
  if (depart.slice(0, 7) === ret.slice(0, 7)) {
    return `${day.format(isoToDate(depart))}–${dayMonth.format(isoToDate(ret))}`;
  }
  return `${dayMonth.format(isoToDate(depart))} – ${dayMonth.format(isoToDate(ret))}`;
}

/** Page title and meta description for a plan, in the interface language. Assumes a validated search. */
export function describeSearch(state: SearchState, { locale, intl, m, f }: I18n): { title: string; description: string } {
  const origin = findOrigin(state.from, locale);
  const destination = findDestination(state.to);
  if (!origin || !destination) return { title: m.plan.title, description: m.plan.fallbackDescription };

  const nights = daysBetween(state.depart, state.return);
  const range = formatDateRange(state.depart, state.return, intl);
  const city = cityName(destination, locale);
  const people = f(m.search.peopleCount, { count: state.pax });
  return {
    title: `${origin.name} → ${city} · ${range} · ${people}`,
    description: f(m.plan.metaDescription, {
      origin: origin.name,
      airports: origin.airports.map((a) => a.code).join(", "),
      city,
      country: countryName(destination, locale),
      range,
      nights,
      people,
    }),
  };
}
