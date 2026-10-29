import { describe, expect, it } from "vitest";
import { EN, TR } from "@/test/i18n";
import { describeSearch, formatDateRange } from "./describe";

describe("plan title and description", () => {
  it("formats date ranges within and across months", () => {
    expect(formatDateRange("2026-11-14", "2026-11-18")).toBe("14–18 Kas");
    expect(formatDateRange("2026-11-28", "2026-12-03")).toBe("28 Kas – 3 Ara");
    expect(formatDateRange("2026-11-14", "2026-11-18", "en-GB")).toBe("14–18 Nov");
  });

  it("describes the search for the page title and meta description", () => {
    const search = { from: "IST", to: "BCN", depart: "2026-11-14", return: "2026-11-18", pax: 2 };
    const { title, description } = describeSearch(search, TR);
    expect(title).toBe("İstanbul → Barselona · 14–18 Kas · 2 kişi");
    expect(description).toContain("İstanbul (IST, SAW) çıkışlı Barselona, İspanya planı");
    expect(description).toContain("4 gece, 2 kişi");
    const english = describeSearch(search, EN);
    expect(english.title).toBe("Istanbul → Barcelona · 14–18 Nov · 2 people");
    expect(english.description).toContain("Plan for Barcelona, Spain from Istanbul (IST, SAW): 14–18 Nov, 4 nights, 2 people.");
  });
});
