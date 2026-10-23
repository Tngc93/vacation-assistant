/** The name and line the interface shows. The repo, package and URLs keep "vacation-assistant". */
export const BRAND_NAME = "Vacationist";
export const BRAND_TAGLINE = "Kısa şehir kaçamakları için planlayıcı";
export const BRAND_DESCRIPTION = `${BRAND_TAGLINE}: Türkiye'den en ucuz uçuş, TL bütçe ve gün gün şehir planı.`;

/** The open source repository (footer, README). */
export const REPO_URL = "https://github.com/Tngc93/vacation-assistant";

/**
 * The canonical address for absolute URLs (Open Graph images, sitemap, robots). On Vercel it is the project's
 * production domain, so a fork deployed elsewhere points at itself; otherwise the live site.
 */
export const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "https://vacation-assistant-nine.vercel.app";
