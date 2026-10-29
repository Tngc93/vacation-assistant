import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BUDGET_CURRENCIES,
  convertAmount,
  CURRENCY_STORAGE_KEY,
  DEFAULT_BUDGET_CURRENCY,
  defaultBudgetCurrency,
  effectiveCurrency,
  parseBudgetCurrency,
  readRememberedCurrency,
  rememberCurrency,
} from "./currency";

const rates = { EUR: { tryPerUnit: 55.618 }, USD: { tryPerUnit: 49.4463 } };

describe("budget currency", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("offers TRY, EUR, USD and GBP; TRY by default in Turkish, EUR once the English UI comes", () => {
    expect(BUDGET_CURRENCIES).toEqual(["TRY", "EUR", "USD", "GBP"]);
    expect(DEFAULT_BUDGET_CURRENCY).toBe("TRY");
    expect(defaultBudgetCurrency("tr")).toBe("TRY");
    expect(defaultBudgetCurrency("en")).toBe("EUR");
  });

  it("reads only the supported codes", () => {
    expect(parseBudgetCurrency("eur")).toBe("EUR");
    expect(parseBudgetCurrency(" GBP ")).toBe("GBP");
    for (const bad of ["CZK", "TL", "", "EURO", null, undefined, ["EUR"]]) expect(parseBudgetCurrency(bad)).toBeNull();
  });

  it("stays in TRY when the chosen currency has no rate", () => {
    expect(effectiveCurrency("EUR", rates)).toBe("EUR");
    expect(effectiveCurrency("GBP", rates)).toBe("TRY");
    expect(effectiveCurrency("TRY", {})).toBe("TRY");
  });

  it("converts through TRY, and never without both rates", () => {
    expect(convertAmount(12000, "EUR", "USD", rates)).toBe(13498);
    expect(convertAmount(300000, "TRY", "EUR", rates)).toBe(5394);
    expect(convertAmount(5394, "EUR", "TRY", rates)).toBe(300003);
    expect(convertAmount(777, "GBP", "GBP", {})).toBe(777);
    expect(convertAmount(12000, "GBP", "EUR", rates)).toBeNull();
    expect(convertAmount(12000, "EUR", "GBP", rates)).toBeNull();
  });

  it("remembers the last choice, but not the default", () => {
    expect(readRememberedCurrency()).toBeNull();
    rememberCurrency("USD");
    expect(window.localStorage.getItem(CURRENCY_STORAGE_KEY)).toBe("USD");
    expect(readRememberedCurrency()).toBe("USD");
    rememberCurrency("TRY");
    expect(window.localStorage.getItem(CURRENCY_STORAGE_KEY)).toBeNull();
  });

  it("ignores a stored value it does not know", () => {
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, "BTC");
    expect(readRememberedCurrency()).toBeNull();
  });

  it("never throws when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readRememberedCurrency()).toBeNull();
    expect(() => rememberCurrency("EUR")).not.toThrow();
    expect(() => rememberCurrency("TRY")).not.toThrow();
  });
});
