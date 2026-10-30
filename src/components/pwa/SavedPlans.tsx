"use client";

import { useEffect, useState } from "react";
import { Caption } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { BRAND_NAME } from "@/lib/brand";
import { PLAN_CACHE, PLAN_TITLE_HEADER } from "@/lib/pwa/sw";

type Saved = { href: string; title: string };

/** The plans the service worker saved (the last ten), newest first, as links that open offline. */
async function readSavedPlans(): Promise<Saved[]> {
  if (!("caches" in window)) return [];
  const cache = await caches.open(PLAN_CACHE);
  const saved: Saved[] = [];
  for (const request of await cache.keys()) {
    const url = new URL(request.url);
    if (url.origin !== window.location.origin) continue;
    const header = (await cache.match(request))?.headers.get(PLAN_TITLE_HEADER) ?? "";
    let title = "";
    try {
      title = decodeURIComponent(header);
    } catch {
      // A malformed header: the address stands in for the title.
    }
    // The page title without the site name it ends with.
    title = title.replace(` · ${BRAND_NAME}`, "");
    saved.push({ href: `${url.pathname}${url.search}`, title: title || url.pathname });
  }
  return saved.reverse();
}

export function SavedPlans() {
  const { m } = useI18n();
  const [plans, setPlans] = useState<Saved[]>([]);
  useEffect(() => {
    let live = true;
    readSavedPlans()
      .then((saved) => live && setPlans(saved))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  if (plans.length === 0) return null;
  return (
    <section aria-labelledby="saved-plans" className="mt-12 max-w-2xl border-t border-rule pt-8">
      <Caption as="h2" id="saved-plans">
        {m.offline.savedTitle}
      </Caption>
      <p className="mt-2 text-caption text-ink-muted">{m.offline.savedLead}</p>
      <ul className="mt-4 grid gap-2">
        {plans.map((plan) => (
          <li key={plan.href}>
            {/* A full page load, so the service worker answers it from the cache. */}
            <a href={plan.href} className="text-body text-ink underline decoration-rule hover:decoration-ink">
              {plan.title}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
