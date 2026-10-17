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

/** Travelpayouts partner IDs; both are public (they appear in every partner link). */
export type Partner = { marker: string | null; trs: string | null };

/**
 * The partner link format that Travelpayouts' partner-links API
 * (POST /links/v1/create, shorten=false) returns for Aviasales:
 * https://tp.media/r?campaign_id=100&marker=…&p=4114&trs=…&u=<url>.
 * Checked against the API on 2026-10-17; re-check with
 * `npm run verify:partner-links`. tp.media redirects to the Aviasales URL
 * with the marker and a click id.
 */
export const AVIASALES_CAMPAIGN_ID = "100";
export const AVIASALES_PROGRAM_P = "4114";

const numeric = (value: string | null | undefined): value is string => !!value && /^\d+$/.test(value);

/** Wraps an Aviasales URL in the partner link (marker + project), or just adds the marker when there is no project. */
export function partnerUrl(url: string, partner?: Partner): string {
  if (numeric(partner?.marker) && numeric(partner?.trs)) {
    const params = new URLSearchParams({
      campaign_id: AVIASALES_CAMPAIGN_ID,
      marker: partner.marker,
      p: AVIASALES_PROGRAM_P,
      trs: partner.trs,
      u: url,
    });
    return `https://tp.media/r?${params}`;
  }
  if (numeric(partner?.marker)) {
    const withMarker = new URL(url);
    withMarker.searchParams.set("marker", partner.marker);
    return withMarker.toString();
  }
  return url;
}

/** Aviasales results for the search, through the partner link when partner IDs are set. */
export function aviasalesSearchUrl(search: LinkSearch, partner?: Partner): string {
  return partnerUrl(`https://www.aviasales.com/search/${aviasalesParams(search)}`, partner);
}

/** The same round trip on Google Flights, as a plain link (no API), in Turkish and lira. */
export function googleFlightsUrl(search: Omit<LinkSearch, "pax">): string {
  const url = new URL("https://www.google.com/travel/flights");
  url.searchParams.set("q", `Flights to ${search.destination} from ${search.origin} on ${search.depart} through ${search.return}`);
  url.searchParams.set("hl", "tr");
  url.searchParams.set("curr", "TRY");
  return url.toString();
}
