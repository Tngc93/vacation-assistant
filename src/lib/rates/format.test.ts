import { describe, expect, it } from "vitest";
import { formatCrossRate, formatRate, formatRateLine, formatRateSources, formatSourceDates } from "./format";
import { SOURCES } from "./types";

describe("rate formatting", () => {
  it("writes the plan's rate line", () => {
    expect(formatRateLine({ ok: true, currency: "EUR", tryPerUnit: 38.4213, source: SOURCES.tcmb, date: "2026-10-16" })).toBe(
      "1 EUR = 38,42 ₺ · TCMB · 16 Eki",
    );
  });

  it("scales small currencies so the amount stays readable", () => {
    expect(formatRate({ currency: "JPY", tryPerUnit: 0.313773 })).toBe("100 JPY = 31,38 ₺");
    expect(formatRate({ currency: "KRW", tryPerUnit: 0.03733 })).toBe("100 KRW = 3,73 ₺");
    expect(formatRate({ currency: "UZS", tryPerUnit: 0.00414 })).toBe("1.000 UZS = 4,14 ₺");
    expect(formatRate({ currency: "GBP", tryPerUnit: 66.0056 })).toBe("1 GBP = 66,01 ₺");
  });
});

describe("cross rates for the budget's currency", () => {
  it("writes one destination unit in the chosen currency, through TRY", () => {
    expect(formatCrossRate("EUR", 55.618, "USD", 49.4463)).toBe("1 EUR = 1,12 USD");
    expect(formatCrossRate("CZK", 2.2481, "EUR", 55.618)).toBe("100 CZK = 4,04 EUR");
    expect(formatCrossRate("JPY", 0.313773, "GBP", 66.0056)).toBe("1.000 JPY = 4,75 GBP");
    // In lira it is the plan's usual line.
    expect(formatCrossRate("EUR", 55.618, "TRY", 1)).toBe("1 EUR = 55,62 ₺");
  });

  it("names each source and date once", () => {
    const tcmb = { sourceName: "TCMB", date: "2026-10-29" };
    expect(formatRateSources([tcmb])).toBe("Kur: TCMB · 29 Eki");
    expect(formatRateSources([tcmb, tcmb])).toBe("Kur: TCMB · 29 Eki");
    expect(formatSourceDates([tcmb, { sourceName: "Frankfurter (ECB)", date: "2026-10-28" }])).toBe("TCMB · 29 Eki; Frankfurter (ECB) · 28 Eki");
  });
});
