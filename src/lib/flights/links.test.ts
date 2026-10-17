import { describe, expect, it } from "vitest";
import { aviasalesParams, aviasalesSearchUrl, googleFlightsUrl, partnerUrl } from "./links";

const search = { origin: "IST", destination: "BCN", depart: "2026-11-14", return: "2026-11-18", pax: 2 };

describe("links to live prices", () => {
  it("encodes the Aviasales search as origin, DDMM, destination, DDMM and adults", () => {
    expect(aviasalesParams(search)).toBe("IST1411BCN18112");
    expect(aviasalesParams({ ...search, origin: "ESB", destination: "AMS", depart: "2026-01-05", return: "2026-02-01", pax: 9 })).toBe(
      "ESB0501AMS01029",
    );
  });

  it("wraps the search in the Travelpayouts partner link when marker and project are set", () => {
    const url = new URL(aviasalesSearchUrl(search, { marker: "123456", trs: "654321" }));
    expect(url.origin + url.pathname).toBe("https://tp.media/r");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      campaign_id: "100",
      marker: "123456",
      p: "4114",
      trs: "654321",
      u: "https://www.aviasales.com/search/IST1411BCN18112",
    });
  });

  it("falls back to a plain marker without a project, and to the bare link without a marker", () => {
    expect(aviasalesSearchUrl(search)).toBe("https://www.aviasales.com/search/IST1411BCN18112");
    expect(aviasalesSearchUrl(search, { marker: "123456", trs: null })).toBe("https://www.aviasales.com/search/IST1411BCN18112?marker=123456");
    expect(aviasalesSearchUrl(search, { marker: null, trs: "654321" })).toBe("https://www.aviasales.com/search/IST1411BCN18112");
    // Only numeric ids are used, so nothing can be injected into the link.
    expect(partnerUrl("https://www.aviasales.com/search/X1", { marker: "12&x=1", trs: "1" })).toBe("https://www.aviasales.com/search/X1");
  });

  it("opens the same round trip on Google Flights in Turkish and lira", () => {
    const url = new URL(googleFlightsUrl(search));
    expect(url.origin + url.pathname).toBe("https://www.google.com/travel/flights");
    expect(url.searchParams.get("q")).toBe("Flights to BCN from IST on 2026-11-14 through 2026-11-18");
    expect(url.searchParams.get("hl")).toBe("tr");
    expect(url.searchParams.get("curr")).toBe("TRY");
  });
});
