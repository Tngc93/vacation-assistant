import { describe, expect, it } from "vitest";
import { formatMessage } from "./format";

describe("formatMessage", () => {
  it("fills placeholders, numbers in the language's grouping", () => {
    expect(formatMessage("tr", "{city} gezisi", { city: "Roma" })).toBe("Roma gezisi");
    expect(formatMessage("tr", "{count} dilde", { count: 1234 })).toBe("1.234 dilde");
    expect(formatMessage("en", "in {count} languages", { count: 1234 })).toBe("in 1,234 languages");
  });

  it("chooses the plural form by the language's rules, # being the count", () => {
    const nights = "{count, plural, one {# night} other {# nights}}";
    expect(formatMessage("en", nights, { count: 1 })).toBe("1 night");
    expect(formatMessage("en", nights, { count: 4 })).toBe("4 nights");
    expect(formatMessage("en", "{count, plural, =0 {none} one {# stop} other {# stops}}", { count: 0 })).toBe("none");
    expect(formatMessage("en", "Day {day} · {count, plural, one {# STOP} other {# STOPS}}", { day: 2, count: 3 })).toBe("Day 2 · 3 STOPS");
  });

  it("refuses a missing value rather than show a raw placeholder", () => {
    expect(() => formatMessage("tr", "{city} gezisi", {})).toThrow(/city/);
  });
});
