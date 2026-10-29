import type { Metadata } from "next";
import { localePath, type Locale } from "./locales";

/**
 * `canonical` and `hreflang` for a page in both languages: the page's own address is canonical, Turkish is
 * `x-default` (no automatic language redirect, so the root is what a visitor without a choice gets). `query`
 * (without "?") is kept on every address, so a shared plan names the same trip in the other language.
 */
export function languageAlternates(locale: Locale, path: string, query = ""): NonNullable<Metadata["alternates"]> {
  const at = (l: Locale) => `${localePath(l, path)}${query ? `?${query}` : ""}`;
  return {
    canonical: at(locale),
    languages: { tr: at("tr"), en: at("en"), "x-default": at("tr") },
  };
}
