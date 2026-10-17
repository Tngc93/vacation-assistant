import { describe, expect, it } from "vitest";
import { nearbyMonthPairs, PRICES_URL, pricesSearchParams, pricesUrl } from "./params";

describe("prices_for_dates parameters", () => {
  const query = { origin: "SAW", destination: "BCN", departureAt: "2026-11-14", returnAt: "2026-11-18", direct: false, limit: 30 };

  it("asks for round trips in lira, cheapest first, for the chosen airport and city", () => {
    expect(Object.fromEntries(pricesSearchParams(query))).toEqual({
      origin: "SAW",
      destination: "BCN",
      departure_at: "2026-11-14",
      return_at: "2026-11-18",
      one_way: "false",
      direct: "false",
      currency: "try",
      sorting: "price",
      unique: "false",
      limit: "30",
      page: "1",
    });
    expect(pricesUrl({ ...query, direct: true })).toBe(
      `${PRICES_URL}?origin=SAW&destination=BCN&departure_at=2026-11-14&return_at=2026-11-18&one_way=false&direct=true&currency=try&sorting=price&unique=false&limit=30&page=1`,
    );
  });

  it("never puts a token in the URL", () => {
    expect(pricesUrl(query)).not.toMatch(/token/i);
  });

  it("covers the ±3 day window with as few month requests as possible", () => {
    expect(nearbyMonthPairs("2026-11-14", "2026-11-18")).toEqual([{ departMonth: "2026-11", returnMonth: "2026-11" }]);
    // Departure window crosses into December; return window stays there.
    expect(nearbyMonthPairs("2026-11-29", "2026-12-10")).toEqual([
      { departMonth: "2026-11", returnMonth: "2026-12" },
      { departMonth: "2026-12", returnMonth: "2026-12" },
    ]);
    // Both cross a year boundary: a return month is never before the departure month.
    expect(nearbyMonthPairs("2026-12-30", "2027-01-02")).toEqual([
      { departMonth: "2026-12", returnMonth: "2026-12" },
      { departMonth: "2026-12", returnMonth: "2027-01" },
      { departMonth: "2027-01", returnMonth: "2027-01" },
    ]);
  });
});
