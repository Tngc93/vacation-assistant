export type RateSourceId = "tcmb" | "frankfurter" | "erapi";

export type RateSource = {
  id: RateSourceId;
  /** Short label shown next to the rate. */
  name: string;
  /** Where the attribution link points. */
  url: string;
};

export const SOURCES: Record<RateSourceId, RateSource> = {
  tcmb: { id: "tcmb", name: "TCMB", url: "https://www.tcmb.gov.tr/kurlar/today.xml" },
  frankfurter: { id: "frankfurter", name: "Frankfurter (ECB)", url: "https://frankfurter.dev" },
  // Attribution required on pages that show these rates: "Rates By Exchange Rate API".
  erapi: { id: "erapi", name: "Exchange Rate API", url: "https://www.exchangerate-api.com" },
};

/** Price of one unit of `currency` in Turkish lira. */
export type RateFound = {
  ok: true;
  currency: string;
  tryPerUnit: number;
  source: RateSource;
  /** Date the source published the rate (YYYY-MM-DD). */
  date: string;
};

export type RateMissing = {
  ok: false;
  currency: string;
  /** Why each source failed, in the order they were tried. */
  attempts: Array<{ source: RateSourceId; reason: string }>;
};

export type RateResult = RateFound | RateMissing;

/**
 * TRY per unit by currency (TCMB → Frankfurter → Exchange Rate API), serialisable for client components.
 * A currency whose rate could not be fetched is absent: no conversion, never a guess.
 */
export type RateTable = Record<string, { tryPerUnit: number; sourceId: RateSourceId; sourceName: string; date: string }>;

export type Fetcher = (url: string, init: RequestInit & { next?: { revalidate?: number } }) => Promise<Response>;
