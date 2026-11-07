/**
 * The interface languages. Turkish is the default and lives at the root (/, /plan); English lives under /en
 * (/en, /en/plan). There is no automatic redirect by browser language: the header's TR / EN switch is the only way
 * between them.
 */
export const LOCALES = ["tr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "tr";

/** The Intl locale each language formats with: Turkish dates and numbers, British English ("14 Nov Sat", 24-hour). */
export const INTL_LOCALE: Record<Locale, string> = { tr: "tr-TR", en: "en-GB" };

/** Open Graph `og:locale`. */
export const OG_LOCALE: Record<Locale, string> = { tr: "tr_TR", en: "en_GB" };

export const isLocale = (value: unknown): value is Locale => value === "tr" || value === "en";

/** The privacy page: /gizlilik in Turkish, /en/privacy in English. */
export const PRIVACY_PATH = "/gizlilik";

/**
 * Pages whose address is a word, so it differs by language. Keyed by the Turkish path, which is the path every
 * other function here takes and returns; the English word lives only in the address.
 */
const TRANSLATED_PATHS: Readonly<Record<string, Readonly<Partial<Record<Locale, string>>>>> = { [PRIVACY_PATH]: { en: "/privacy" } };

/** A site path in a language: "/plan" → "/en/plan", "/" → "/en", "/gizlilik" → "/en/privacy"; Turkish paths stay as they are. */
export function localePath(locale: Locale, path: string): string {
  if (locale === DEFAULT_LOCALE) return path;
  if (path === "/") return `/${locale}`;
  if (path.startsWith("/?")) return `/${locale}${path.slice(1)}`;
  const end = path.search(/[?#]/);
  const pathname = end === -1 ? path : path.slice(0, end);
  const translated = TRANSLATED_PATHS[pathname]?.[locale];
  return translated ? `/${locale}${translated}${path.slice(pathname.length)}` : `/${locale}${path}`;
}

/** The language of a pathname and the (Turkish) path without its prefix: "/en/plan" → en, "/plan"; "/en/privacy" → en, "/gizlilik". */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const match = /^\/en(?=\/|$)(.*)$/.exec(pathname);
  if (match) {
    const path = match[1] || "/";
    const turkish = Object.keys(TRANSLATED_PATHS).find((tr) => TRANSLATED_PATHS[tr].en === path);
    return { locale: "en", path: turkish ?? path };
  }
  return { locale: DEFAULT_LOCALE, path: pathname || "/" };
}

/** The same page in another language, its query and hash kept: "/plan?to=BCN" → "/en/plan?to=BCN". */
export function switchLocaleHref(target: Locale, pathname: string, search = "", hash = ""): string {
  return `${localePath(target, splitLocale(pathname).path)}${search}${hash}`;
}
