/**
 * Links to live prices. Aviasales search URLs follow the documented
 * template https://www.aviasales.com/search/PARAMS, where PARAMS is
 * origin + DDMM + destination + DDMM + number of adults
 * (https://support.travelpayouts.com/hc/en-us/articles/5711895629714).
 * Neither link needs the API token.
 */
export type LinkSearch = {
  /** IATA airport or city code. */
  origin: string;
  /** IATA city code. */
  destination: string;
  /** YYYY-MM-DD */
  depart: string;
  /** YYYY-MM-DD */
  return: string;
  /** Adults, 1–9 (Aviasales encodes it as one digit). */
  pax: number;
};

const ddmm = (iso: string) => `${iso.slice(8, 10)}${iso.slice(5, 7)}`;

/** "IST1411BCN18112": out on 14 Nov, back on 18 Nov, two adults. */
export function aviasalesParams(search: LinkSearch): string {
  const pax = Math.min(9, Math.max(1, Math.trunc(search.pax)));
  return `${search.origin}${ddmm(search.depart)}${search.destination}${ddmm(search.return)}${pax}`;
}

/** Aviasales results for the search, with the partner marker when one is set (markers are numeric). */
export function aviasalesSearchUrl(search: LinkSearch, marker?: string): string {
  const url = new URL(`https://www.aviasales.com/search/${aviasalesParams(search)}`);
  if (marker && /^\d+$/.test(marker)) url.searchParams.set("marker", marker);
  return url.toString();
}

/** The same round trip on Google Flights, as a plain link (no API), in Turkish and lira. */
export function googleFlightsUrl(search: Omit<LinkSearch, "pax">): string {
  const url = new URL("https://www.google.com/travel/flights");
  url.searchParams.set("q", `Flights to ${search.destination} from ${search.origin} on ${search.depart} through ${search.return}`);
  url.searchParams.set("hl", "tr");
  url.searchParams.set("curr", "TRY");
  return url.toString();
}
