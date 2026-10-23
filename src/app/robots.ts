import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/brand";

/**
 * Everything may be crawled; only the home page is in the sitemap. /plan and /styleguide say noindex in their
 * own metadata instead of being disallowed here: a disallowed page's noindex is never read, and link-preview
 * bots (which obey robots.txt) could no longer show a shared plan's card.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
