import { describe, expect, it } from "vitest";
import { formatRate, formatRateLine } from "./format";
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
