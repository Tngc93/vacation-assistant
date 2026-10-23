"use client";

import { Analytics } from "@vercel/analytics/react";
import { usePathname } from "next/navigation";
import { pathOnly } from "@/lib/analytics";

/**
 * Page views for Vercel Web Analytics (cookieless). Route and path are the pathname alone: the query string is never
 * read here, and changing the trip in the URL (dates, budget, skipped stops) is not a new page view. The script and its
 * beacon come from our own origin (`/_vercel/insights/*`), which the CSP already allows as 'self'.
 */
export function SiteAnalytics() {
  const path = usePathname();
  return <Analytics mode="production" framework="next" route={path} path={path} beforeSend={pathOnly} />;
}
