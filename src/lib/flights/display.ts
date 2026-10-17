import { formatDay } from "@/lib/format";
import { isoToDate } from "@/lib/search/dates";

/** Turkish names of the phase-1 origin airports. */
export const AIRPORT_NAMES: Record<string, string> = {
  IST: "İstanbul Havalimanı",
  SAW: "Sabiha Gökçen",
  ESB: "Esenboğa",
};

/** `?direct=1` turns on the non-stop filter. */
export function parseDirect(raw: string | string[] | null | undefined): boolean {
  return (Array.isArray(raw) ? raw[0] : raw) === "1";
}

/** "4 sa 05 dk", "55 dk" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} sa ${String(m).padStart(2, "0")} dk` : `${m} dk`;
}

/** "AKTARMASIZ", "1 AKTARMA" */
export const formatStops = (stops: number) => (stops === 0 ? "AKTARMASIZ" : `${stops} AKTARMA`);

/** "14 Kas Cmt" for a YYYY-MM-DD date. */
export const formatTicketDay = (iso: string) => formatDay(isoToDate(iso));

/**
 * "ÖNBELLEKTEN · 16 EKİ'DE BULUNDU · TAHMİNİ". The API only gives the day of
 * the search (in the ticket link); without it, the documented window is used.
 */
export function cacheCaption(foundOn: string | null): string {
  if (!foundOn) return "ÖNBELLEKTEN · SON 48 SAATTE BULUNDU · TAHMİNİ";
  const [day, month] = formatTicketDay(foundOn).split(" ");
  return `ÖNBELLEKTEN · ${day} ${month.toLocaleUpperCase("tr")} TARİHİNDE BULUNDU · TAHMİNİ`;
}
