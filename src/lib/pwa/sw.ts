/**
 * What the page and the service worker (public/sw.js) share. sw.js is a plain script outside the bundle, so the
 * values are repeated there; sw.test.ts checks that both say the same.
 */
import { localePath, type Locale } from "@/i18n/locales";

export const SW_PATH = "/sw.js";

/** The build the page belongs to (next.config.ts: the commit), so every deploy registers a new worker. */
export const BUILD_ID = process.env.NEXT_PUBLIC_VA_BUILD ?? "local";

/** The worker's address: the build in the query names its caches and makes each deploy an update. */
export function serviceWorkerUrl(build: string = BUILD_ID): string {
  return `${SW_PATH}?v=${encodeURIComponent(build)}`;
}

/** Plans opened online, the last ten, kept across versions; each entry carries its page title. */
export const PLAN_CACHE = "va-plans";
/** Header on a cached plan: its `<title>`, URI-encoded (headers are Latin-1). */
export const PLAN_TITLE_HEADER = "x-va-title";
/** Set on `<html>` by the worker when a page comes from the cache instead of the network. */
export const OFFLINE_ATTRIBUTE = "data-va-offline";

export function offlinePath(locale: Locale): string {
  return localePath(locale, "/offline");
}

/**
 * Where "Yeniden dene" goes on the offline page: the `?from=` the worker redirected from, if it is a path on this
 * site; otherwise the home page.
 */
export function retryTarget(search: string, locale: Locale): string {
  const home = localePath(locale, "/");
  const from = new URLSearchParams(search).get("from");
  if (!from?.startsWith("/")) return home;
  // Parsed against a placeholder origin: "//host" and "/\host" would leave it.
  const base = "https://vacationist.invalid";
  const url = new URL(from, base);
  return url.origin === base ? `${url.pathname}${url.search}` : home;
}
