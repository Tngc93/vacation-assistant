import { describe, expect, it } from "vitest";
import {
  amountFromParam,
  amountToInput,
  amountToParam,
  formatMinor,
  MAX_INPUT_MINOR,
  parseAmountInput,
  perPersonLira,
  rateToMicros,
  roundToLira,
  toKurus,
} from "./money";

describe("amounts in minor units", () => {
  it("reads what people type, with a comma or a dot", () => {
    expect(parseAmountInput("1250")).toEqual({ ok: true, minor: 125000 });
    expect(parseAmountInput(" 1250,5 ")).toEqual({ ok: true, minor: 125050 });
    expect(parseAmountInput("1250.05")).toEqual({ ok: true, minor: 125005 });
    expect(parseAmountInput("0,10")).toEqual({ ok: true, minor: 10 });
  });

  it("refuses thousands separators, signs, three decimals and zero", () => {
    // "1.250" is ambiguous (1,25 or 1 250?), so it is refused rather than guessed.
    for (const bad of ["1.250", "1.250,50", "-5", "1,234", "abc", "", "0", "0,00", "12,345"]) {
      expect(parseAmountInput(bad).ok, bad).toBe(false);
    }
    expect(parseAmountInput(String(MAX_INPUT_MINOR / 100 + 1)).ok).toBe(false);
  });

  it("round-trips through the URL and the input box", () => {
    for (const minor of [125000, 125050, 125005, 10, 1]) {
      expect(amountFromParam(amountToParam(minor))).toBe(minor);
    }
    expect(amountToParam(125050)).toBe("1250.5");
    expect(amountToInput(125050)).toBe("1250,5");
    expect(amountFromParam("1,5")).toBeNull();
    expect(amountFromParam("abc")).toBeNull();
    expect(amountFromParam(null)).toBeNull();
  });

  it("has no floating-point drift", () => {
    // 0.1 + 0.2 in floats is 0.30000000000000004; in kuruş it is 30.
    const a = parseAmountInput("0,1");
    const b = parseAmountInput("0,2");
    expect(a.ok && b.ok && a.minor + b.minor).toBe(30);
    // 1250,10 × 3 nights is exactly 3750,30.
    const stay = parseAmountInput("1250,10");
    expect(stay.ok && stay.minor * 3).toBe(375030);
    // 19,99 EUR at 55,618 = 1111,80382 TRY → 111180 kuruş (half up).
    expect(toKurus(1999, 55.618)).toBe(111180);
    expect(rateToMicros(55.618)).toBe(BigInt(55_618_000));
    // 0,05 at 0,1 is 0,005 TRY → half up to 1 kuruş.
    expect(toKurus(5, 0.1)).toBe(1);
  });

  it("rounds to whole lira half up and splits per person", () => {
    expect(roundToLira(12349)).toBe(12300);
    expect(roundToLira(12350)).toBe(12400);
    expect(perPersonLira(1000000, 3)).toBe(333300);
    expect(perPersonLira(1000050, 2)).toBe(500000);
  });

  it("formats in Turkish with the currency", () => {
    expect(formatMinor(1245000, "TRY")).toBe("12.450 ₺");
    expect(formatMinor(125050, "EUR")).toBe("1.250,50 EUR");
    expect(formatMinor(30000, "EUR")).toBe("300 EUR");
  });
});
