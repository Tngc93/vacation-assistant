import { describe, expect, it } from "vitest";
import { formatDay, formatMoney, formatTime, formatTRY } from "./format";

describe("Turkish formatting", () => {
  it("formats lira with Turkish grouping and the symbol after the amount", () => {
    expect(formatTRY(12450)).toBe("12.450 ₺");
    expect(formatTRY(980)).toBe("980 ₺");
    expect(formatTRY(1234567.6)).toBe("1.234.568 ₺");
  });

  it("formats days as day, short month, short weekday in Istanbul time", () => {
    expect(formatDay(new Date(Date.UTC(2026, 10, 13, 9)))).toBe("13 Kas Cum");
    // 22:30 UTC on the 13th is already the 14th in Istanbul (UTC+3).
    expect(formatDay(new Date(Date.UTC(2026, 10, 13, 22, 30)))).toBe("14 Kas Cmt");
  });

  it("uses 24-hour times", () => {
    expect(formatTime(new Date(Date.UTC(2026, 10, 13, 15, 5)))).toBe("18:05");
  });
});

describe("money in the budget's currency", () => {
  it("keeps lira as the site writes it, symbol after", () => {
    expect(formatMoney(1245000, "TRY")).toBe("12.450 ₺");
    expect(formatMoney(125050, "TRY")).toBe("1.250,50 ₺");
  });

  it("lets Intl (tr-TR) place the other symbols, with cents only when there are any", () => {
    const intl = (value: number, currency: string, digits: number) =>
      new Intl.NumberFormat("tr-TR", { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
    expect(formatMoney(124000, "EUR")).toBe(intl(1240, "EUR", 0));
    expect(formatMoney(124050, "USD")).toBe(intl(1240.5, "USD", 2));
    expect(formatMoney(30000, "GBP")).toBe(intl(300, "GBP", 0));
    // Turkish grouping and decimal comma whatever the symbol's place.
    expect(formatMoney(124050, "EUR")).toMatch(/1\.240,50/);
    expect(formatMoney(124000, "EUR")).toContain("€");
  });
});
