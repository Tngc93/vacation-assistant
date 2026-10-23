import type { BeforeSendEvent } from "@vercel/analytics/react";

/**
 * Vercel Web Analytics counts visits on the production deployment only. Development, preview deployments and a local
 * `npm start` never load the script; NODE_ENV guards against a `.env.local` pulled from production during `next dev`.
 */
export function analyticsEnabled(env: { NODE_ENV?: string; VERCEL_ENV?: string } = process.env): boolean {
  return env.NODE_ENV === "production" && env.VERCEL_ENV === "production";
}

/**
 * Runs on every event before it leaves the browser. The query string is the whole trip (city, dates, origin, budget,
 * skipped stops, AI picks and edits), so only our origin and the path are sent: `/plan?to=BCN&…` counts as `/plan`.
 * The site sends no custom events (Hobby has none), so anything but a page view is dropped.
 */
export function pathOnly(event: BeforeSendEvent): BeforeSendEvent | null {
  if (event.type !== "pageview") return null;
  const url = new URL(event.url);
  return { ...event, url: `${url.origin}${url.pathname}` };
}
