import { describe, expect, it } from "vitest";
import { mockProvider } from "./mockProvider";
import type { Connection } from "./providers";
import { httpsUrl, matchSource, searchFlightPrices, searchStayPrices, stayMidpoint, toTryMinor, type RateTable } from "./webPrices";

const KEY = "test-key-not-real";
const NOW = Date.UTC(2026, 9, 21, 18, 40);
const rates: RateTable = { EUR: { tryPerUnit: 40, sourceName: "TCMB", date: "2026-10-21" } };
const query = { fromAirports: ["IST", "SAW"], toCity: "Barcelona", toAirports: ["BCN"], depart: "2026-11-14", return: "2026-11-18", adults: 2 };
const stayQuery = { city: "Barcelona", country: "ES", checkIn: "2026-11-14", checkOut: "2026-11-18", adults: 2 };
const fenced = (value: unknown) => `Here is what I found:\n\`\`\`json\n${JSON.stringify(value)}\n\`\`\``;

const flight = (url: string, over: Record<string, unknown> = {}) => ({ title: "Airline · IST → BCN", price: 9000, currency: "TRY", basis: "per_person", url, ...over });

async function flights(provider: Connection["provider"], text: string, sources: { url: string; title: string }[]) {
  const mock = mockProvider(provider, [{ search: { text, sources } }]);
  return searchFlightPrices({ provider, key: KEY, model: "m" }, query, rates, { fetcher: mock.fetcher, now: NOW });
}

describe("only links the provider listed, only https", () => {
  it("drops a result whose page is not in the provider's source list, and shows the provider's link", async () => {
    const result = await flights(
      "anthropic",
      fenced({ results: [flight("https://example.com/real/"), flight("https://made-up.example.net/deal")] }),
      [{ url: "https://www.example.com/real", title: "Real page" }],
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0].link).toEqual({ url: "https://www.example.com/real", host: "example.com" });
    expect(result.dropped).toBe(1);
  });

  it("drops http, javascript: and data: links even when the provider lists them", async () => {
    const bad = ["http://example.com/a", "javascript:alert(1)", "data:text/html,hi", "https://user:pw@example.com/a"];
    const result = await flights("openai", fenced({ results: bad.map((u) => flight(u)) }), bad.map((url) => ({ url, title: "x" })));
    expect(result.items).toEqual([]);
    expect(result.dropped).toBe(4);
    for (const u of bad) expect(httpsUrl(u)).toBeNull();
  });

  it("ignores utm_ parameters, www, a trailing slash and the fragment when matching, nothing more", () => {
    const sources = [{ url: "https://www.example.com/deal/?utm_source=openai&id=7", title: "x" }];
    expect(matchSource("https://example.com/deal?id=7#top", sources)).toEqual({ url: sources[0].url, host: "example.com" });
    expect(matchSource("https://example.com/deal?id=8", sources)).toBeNull();
    expect(matchSource("https://example.com/other", sources)).toBeNull();
  });

  it("Gemini: the page must be on a domain Google listed; the link shown is Google's redirect", () => {
    const sources = [{ url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AbC", title: "flypgs.com" }];
    expect(matchSource("https://www.flypgs.com/en/cheap-flights", sources)).toEqual({ url: sources[0].url, host: "flypgs.com" });
    expect(matchSource("https://book.flypgs.com/x", sources)?.host).toBe("flypgs.com");
    expect(matchSource("https://flypgs.com.evil.example/x", sources)).toBeNull();
    expect(matchSource("https://another-site.com/x", sources)).toBeNull();
  });

  it("says so when nothing could be linked", async () => {
    const result = await flights("gemini", fenced({ results: [flight("https://example.com/a")] }), []);
    expect(result).toMatchObject({ items: [], dropped: 1, source: "Google Gemini · m", searchedAt: NOW, sample: false });
  });
});

describe("checked answers", () => {
  it("is 'invalid' (with the model named) when the JSON breaks the schema or is missing", async () => {
    const sources = [{ url: "https://example.com/a", title: "x" }];
    for (const text of [fenced({ results: [{ ...flight("https://example.com/a"), price: -5 }] }), fenced({ results: [{ ...flight("https://example.com/a"), currency: "euro" }] }), "no JSON here"]) {
      expect(await flights("anthropic", text, sources).catch((e) => e)).toMatchObject({ kind: "invalid", model: "m" });
    }
  });
});

describe("lira estimates", () => {
  it("converts with our rate, splits totals per adult, sorts cheapest first, and has no lira amount without a rate", async () => {
    const sources = ["a", "b", "c"].map((p) => ({ url: `https://example.com/${p}`, title: p }));
    const result = await flights(
      "anthropic",
      fenced({
        results: [
          flight("https://example.com/a", { price: 250.5, currency: "EUR", basis: "per_person" }),
          flight("https://example.com/b", { price: 15000, currency: "TRY", basis: "total" }),
          flight("https://example.com/c", { price: 300, currency: "USD" }),
        ],
      }),
      sources,
    );
    expect(result.items.map((o) => [o.link.host + o.link.url.slice(-2), o.tryPerAdult])).toEqual([
      ["example.com/b", 750000], // 15.000 TRY for 2 → 7.500 ₺ each
      ["example.com/a", 1002000], // 250,50 EUR × 40 = 10.020 ₺
      ["example.com/c", null], // no USD rate: never a guessed one
    ]);
    expect(toTryMinor(100, "TRY", {})).toBe(100);
  });

  it("writes the middle of a nightly range in the budget's currency", async () => {
    const mock = mockProvider("gemini", [
      { search: { text: fenced({ areas: [{ name: "Eixample", min: 100, max: 151, currency: "EUR", basis: "per_night", url: "https://example.com/e" }] }), sources: [{ url: "https://example.com/e", title: "e" }] } },
    ]);
    const result = await searchStayPrices({ provider: "gemini", key: KEY, model: "m" }, stayQuery, rates, { fetcher: mock.fetcher, now: NOW });
    const [area] = result.items;
    expect(area).toMatchObject({ name: "Eixample", tryMin: 400000, tryMax: 604000 });
    expect(stayMidpoint(area, "EUR", rates)).toBe(12550); // 125,50 EUR
    expect(stayMidpoint(area, "TRY", rates)).toBe(502000); // 5.020 ₺
    expect(stayMidpoint(area, "GBP", rates)).toBeNull();
  });

  it("drops a range whose lowest price is above its highest", async () => {
    const mock = mockProvider("openai", [
      { search: { text: fenced({ areas: [{ name: "X", min: 200, max: 100, currency: "EUR", basis: "per_night", url: "https://example.com/x" }] }), sources: [{ url: "https://example.com/x", title: "x" }] } },
    ]);
    const result = await searchStayPrices({ provider: "openai", key: KEY, model: "m" }, stayQuery, rates, { fetcher: mock.fetcher, now: NOW });
    expect(result).toMatchObject({ items: [], dropped: 1 });
  });
});
