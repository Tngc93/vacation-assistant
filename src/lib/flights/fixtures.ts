import "server-only";
import type { Fetcher } from "./client";
import { fillFixture } from "./fixtureData";

/**
 * Sample responses for development, screenshots and end-to-end tests when no
 * Travelpayouts token is available. They are not real prices: the page says
 * so with a visible banner. Enabled only with VA_FLIGHTS_FIXTURES=1 and never
 * on Vercel.
 */
export function fixturesEnabled(): boolean {
  return process.env.VA_FLIGHTS_FIXTURES === "1" && !process.env.VERCEL;
}

type FixtureTicket = { transfers: number; return_transfers?: number };


/**
 * Answers like `prices_for_dates` from __fixtures__/<origin>-<destination>.json
 * for exact dates and <origin>-<destination>-month.json for whole months.
 */
export const fixtureFetcher: Fetcher = async (url) => {
  const params = new URL(url).searchParams;
  const departureAt = params.get("departure_at") ?? "";
  const returnAt = params.get("return_at") ?? "";
  const exact = /^\d{4}-\d{2}-\d{2}$/.test(departureAt);
  const name = `${params.get("origin")}-${params.get("destination")}${exact ? "" : "-month"}`;
  if (!/^[A-Z]{3}-[A-Z]{3}(-month)?$/.test(name)) return Response.json({ success: false, data: {}, error: "bad fixture request" });
  let data: FixtureTicket[] = [];
  try {
    const sample = (await import(`./__fixtures__/${name}.json`)).default.data as FixtureTicket[];
    data = fillFixture(sample, exact ? { depart: departureAt, return: returnAt } : { month: departureAt, returnMonth: returnAt });
  } catch {
    // No sample: the cache has nothing for this query.
  }
  if (params.get("direct") === "true") data = data.filter((t) => t.transfers === 0 && (t.return_transfers ?? 0) === 0);
  return Response.json({ success: true, data: data.slice(0, Number(params.get("limit") ?? 30)), error: null, currency: "try" });
};
