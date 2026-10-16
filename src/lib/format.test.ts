import { describe, expect, it } from "vitest";
import { formatDay, formatTime, formatTRY } from "./format";

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
