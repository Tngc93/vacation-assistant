import type { MetadataRoute } from "next";
import { LOCALES, localePath, PRIVACY_PATH } from "@/i18n/locales";
import { SITE_URL } from "@/lib/brand";

/** The indexed pages, by their Turkish path. */
const PAGES: ReadonlyArray<{ path: string; priority: number }> = [
  { path: "/", priority: 1 },
  { path: PRIVACY_PATH, priority: 0.3 },
];

/**
 * The home and privacy pages are indexed, in both languages, each naming the other (hreflang); plans are personal
 * links (noindex) and the style guide is a tool.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => (path === "/" ? SITE_URL : `${SITE_URL}${path}`);
  return PAGES.flatMap((page) => {
    const languages = Object.fromEntries(LOCALES.map((l) => [l, url(localePath(l, page.path))]));
    return LOCALES.map((locale) => ({
      url: url(localePath(locale, page.path)),
      changeFrequency: "monthly" as const,
      priority: page.priority,
      alternates: { languages },
    }));
  });
}
