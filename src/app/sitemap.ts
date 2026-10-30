import type { MetadataRoute } from "next";
import { LOCALES, localePath } from "@/i18n/locales";
import { SITE_URL } from "@/lib/brand";

/**
 * Only the home page is indexed, in both languages, each naming the other (hreflang); plans are personal links
 * (noindex) and the style guide is a tool.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => (path === "/" ? SITE_URL : `${SITE_URL}${path}`);
  const languages = Object.fromEntries(LOCALES.map((l) => [l, url(localePath(l, "/"))]));
  return LOCALES.map((locale) => ({
    url: url(localePath(locale, "/")),
    changeFrequency: "monthly",
    priority: 1,
    alternates: { languages },
  }));
}
