import { describe, expect, it } from "vitest";
import { aviasalesParams, aviasalesSearchUrl, googleFlightsUrl } from "./links";

const search = { origin: "IST", destination: "BCN", depart: "2026-11-14", return: "2026-11-18", pax: 2 };

describe("links to live prices", () => {
  it("encodes the Aviasales search as origin, DDMM, destination, DDMM and adults", () => {
    expect(aviasalesParams(search)).toBe("IST1411BCN18112");
    expect(aviasalesParams({ ...search, origin: "ESB", destination: "AMS", depart: "2026-01-05", return: "2026-02-01", pax: 9 })).toBe(
      "ESB0501AMS01029",
    );
  });

  it("adds the partner marker when there is one, and only a numeric one", () => {
    expect(aviasalesSearchUrl(search)).toBe("https://www.aviasales.com/search/IST1411BCN18112");
    expect(aviasalesSearchUrl(search, "123456")).toBe("https://www.aviasales.com/search/IST1411BCN18112?marker=123456");
    expect(aviasalesSearchUrl(search, "12&x=1")).toBe("https://www.aviasales.com/search/IST1411BCN18112");
  });

  it("opens the same round trip on Google Flights in Turkish and lira", () => {
    const url = new URL(googleFlightsUrl(search));
    expect(url.origin + url.pathname).toBe("https://www.google.com/travel/flights");
    expect(url.searchParams.get("q")).toBe("Flights to BCN from IST on 2026-11-14 through 2026-11-18");
    expect(url.searchParams.get("hl")).toBe("tr");
    expect(url.searchParams.get("curr")).toBe("TRY");
  });
});
