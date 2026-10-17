import { describe, expect, it } from "vitest";
import { parseBudgetParams, writeBudgetParams } from "./params";

const REF = "IST-LH1301-202611141905-202611180955";

describe("budget URL params", () => {
  it("reads flight, stay, daily and currency", () => {
    expect(parseBudgetParams({ flight: REF, stay: "3000", daily: "1250.5", cur: "eur" }, "EUR")).toEqual({
      flight: REF,
      stay: 300000,
      daily: 125050,
      cur: "EUR",
    });
  });

  it("drops malformed values and unknown currencies", () => {
    expect(parseBudgetParams({ flight: "x<y", stay: "1,5", daily: "-1", cur: "USD" }, "EUR")).toEqual({
      flight: null,
      stay: null,
      daily: null,
      cur: "TRY",
    });
    expect(parseBudgetParams(new URLSearchParams(""), "GBP")).toEqual({ flight: null, stay: null, daily: null, cur: "TRY" });
  });

  it("writes the budget next to the search, and removes empty values", () => {
    const search = new URLSearchParams("from=IST&to=BCN&depart=2026-11-14&return=2026-11-18&pax=2&cats=see");
    const written = writeBudgetParams(search, { flight: REF, stay: 300000, daily: 125050, cur: "EUR" });
    expect(written.toString()).toBe(
      `from=IST&to=BCN&depart=2026-11-14&return=2026-11-18&pax=2&cats=see&flight=${REF}&stay=3000&daily=1250.5&cur=EUR`,
    );
    expect(writeBudgetParams(written, { stay: null, cur: "TRY" }).toString()).toBe(
      `from=IST&to=BCN&depart=2026-11-14&return=2026-11-18&pax=2&cats=see&flight=${REF}&daily=1250.5`,
    );
    // Round trip: a shared link opens the same budget.
    expect(parseBudgetParams(written, "EUR")).toEqual({ flight: REF, stay: 300000, daily: 125050, cur: "EUR" });
  });
});
