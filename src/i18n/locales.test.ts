import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { homeMetadata } from "@/app/_shell/HomePage";
import { privacyMetadata } from "@/app/_shell/PrivacyPage";
import { languageAlternates } from "./alternates";
import { localePath, PRIVACY_PATH, splitLocale, switchLocaleHref } from "./locales";
import { clientMessages, MESSAGES } from "./server";

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

  it("names the privacy page in each language: /gizlilik and /en/privacy", () => {
    expect(PRIVACY_PATH).toBe("/gizlilik");
    expect(localePath("tr", PRIVACY_PATH)).toBe("/gizlilik");
    expect(localePath("en", PRIVACY_PATH)).toBe("/en/privacy");
    expect(localePath("en", `${PRIVACY_PATH}#iletisim`)).toBe("/en/privacy#iletisim");
    expect(splitLocale("/en/privacy")).toEqual({ locale: "en", path: "/gizlilik" });
    expect(switchLocaleHref("en", "/gizlilik", "", "#olcum")).toBe("/en/privacy#olcum");
    expect(switchLocaleHref("tr", "/en/privacy")).toBe("/gizlilik");
    // Other paths are not translated.
    expect(localePath("en", "/plan?to=BCN")).toBe("/en/plan?to=BCN");
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

  it("names both privacy pages, Turkish as x-default", () => {
    expect(privacyMetadata("en").alternates).toEqual({
      canonical: "/en/privacy",
      languages: { tr: "/gizlilik", en: "/en/privacy", "x-default": "/gizlilik" },
    });
    expect(privacyMetadata("tr").alternates?.canonical).toBe("/gizlilik");
    expect(privacyMetadata("tr").title).toBe("Gizlilik");
    expect(privacyMetadata("en").title).toBe("Privacy");
    expect(privacyMetadata("tr").robots).toBeUndefined();
  });

  it("lists the home and privacy pages in both languages, each naming the other", () => {
    const site = "https://vacationist-app.vercel.app";
    const entries = sitemap();
    expect(entries.map((e) => e.url)).toEqual([site, `${site}/en`, `${site}/gizlilik`, `${site}/en/privacy`]);
    for (const entry of entries.slice(0, 2)) expect(entry.alternates?.languages).toEqual({ tr: site, en: `${site}/en` });
    for (const entry of entries.slice(2)) {
      expect(entry.alternates?.languages).toEqual({ tr: `${site}/gizlilik`, en: `${site}/en/privacy` });
    }
  });
});

describe("the client dictionary", () => {
  it("leaves out the privacy page's copy and keeps everything else", () => {
    for (const locale of ["tr", "en"] as const) {
      const client = clientMessages(locale);
      expect(client).not.toHaveProperty("privacy");
      expect(MESSAGES[locale].privacy.title).toBeTruthy();
      expect(Object.keys(client).sort()).toEqual(Object.keys(MESSAGES[locale]).filter((k) => k !== "privacy").sort());
    }
  });
});
