import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { homeMetadata } from "@/app/_shell/HomePage";
import { languageAlternates } from "./alternates";
import { localePath, splitLocale, switchLocaleHref } from "./locales";

describe("language paths", () => {
  it("keeps Turkish at the root and puts English under /en", () => {
    expect(localePath("tr", "/plan")).toBe("/plan");
    expect(localePath("en", "/plan")).toBe("/en/plan");
    expect(localePath("en", "/")).toBe("/en");
    expect(splitLocale("/en/plan")).toEqual({ locale: "en", path: "/plan" });
    expect(splitLocale("/en")).toEqual({ locale: "en", path: "/" });
    expect(splitLocale("/plan")).toEqual({ locale: "tr", path: "/plan" });
    // Not a language prefix.
    expect(splitLocale("/english")).toEqual({ locale: "tr", path: "/english" });
  });

  it("switches the language keeping every query parameter and the hash", () => {
    const query = "?to=BCN&depart=2026-11-14&return=2026-11-18&from=LON&pax=2&cur=GBP&skip=n1&stay=120";
    expect(switchLocaleHref("en", "/plan", query, "#butce")).toBe(`/en/plan${query}#butce`);
    expect(switchLocaleHref("tr", "/en/plan", query)).toBe(`/plan${query}`);
    expect(switchLocaleHref("en", "/", "?to=ROM")).toBe("/en?to=ROM");
    expect(switchLocaleHref("tr", "/en")).toBe("/");
  });
});

describe("hreflang, canonical and the sitemap", () => {
  it("names both languages on the home pages, Turkish as x-default", () => {
    expect(homeMetadata("en").alternates).toEqual({ canonical: "/en", languages: { tr: "/", en: "/en", "x-default": "/" } });
    expect(homeMetadata("tr").alternates?.canonical).toBe("/");
    expect(languageAlternates("en", "/plan", "to=BCN")).toEqual({
      canonical: "/en/plan?to=BCN",
      languages: { tr: "/plan?to=BCN", en: "/en/plan?to=BCN", "x-default": "/plan?to=BCN" },
    });
  });

  it("lists the home page in both languages, each naming the other", () => {
    const entries = sitemap();
    expect(entries.map((e) => e.url)).toEqual(["https://vacationist-app.vercel.app", "https://vacationist-app.vercel.app/en"]);
    for (const entry of entries) {
      expect(entry.alternates?.languages).toEqual({ tr: "https://vacationist-app.vercel.app", en: "https://vacationist-app.vercel.app/en" });
    }
  });
});
