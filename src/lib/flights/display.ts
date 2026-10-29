import type { I18n } from "@/i18n/i18n";
import type { Locale } from "@/i18n/locales";
import { formatDay } from "@/lib/format";
import { isoToDate } from "@/lib/search/dates";

/** The flight texts are in the interface language. */
type Lang = Pick<I18n, "locale" | "intl" | "m" | "f">;

/**
 * Short names of the airports most trips leave from (messages `flights.airports`: "Sabiha Gökçen"); others show the
 * name in the origins data.
 */
export function shortAirportName(code: string, { m }: Pick<I18n, "m">): string | undefined {
  return (m.flights.airports as Record<string, string>)[code];
}

/** `?direct=1` turns on the non-stop filter. */
export function parseDirect(raw: string | string[] | null | undefined): boolean {
  return (Array.isArray(raw) ? raw[0] : raw) === "1";
}

/** "4 sa 05 dk", "55 dk" ("4 h 05 min") */
export function formatDuration(minutes: number, { m, f }: Pick<Lang, "m" | "f">): string {
  const h = Math.floor(minutes / 60);
  const min = minutes % 60;
  return h ? f(m.flights.duration, { h, m: String(min).padStart(2, "0") }) : f(m.flights.durationMinutes, { m: min });
}

/** "AKTARMASIZ", "1 AKTARMA" ("NON-STOP", "1 STOP") */
export const formatStops = (stops: number, { m, f }: Pick<Lang, "m" | "f">) =>
  stops === 0 ? m.flights.direct : f(m.flights.stops, { count: stops });

/** "14 Kas Cmt" ("14 Nov Sat") for a YYYY-MM-DD date. */
export const formatTicketDay = (iso: string, locale: Locale = "tr") => formatDay(isoToDate(iso), locale);

/**
 * "ÖNBELLEKTEN · 16 EKİ TARİHİNDE BULUNDU · TAHMİNİ". The API only gives the day of the search (in the ticket link);
 * without it, the documented window is used.
 */
export function cacheCaption(foundOn: string | null, { locale, intl, m, f }: Lang): string {
  if (!foundOn) return m.flights.cachedRecently;
  const [day, month] = formatTicketDay(foundOn, locale).split(" ");
  return f(m.flights.cachedOn, { date: `${day} ${month.toLocaleUpperCase(intl)}` });
}
