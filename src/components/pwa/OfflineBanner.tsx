"use client";

import { WifiOff } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { splitLocale } from "@/i18n/locales";
import { useOnline, useServedFromCache } from "./useOffline";

/**
 * The strip under the site header when the network is gone or the page is the service worker's saved copy:
 * "Çevrimdışısın; bu plan son açtığın hâliyle gösteriliyor." A saved copy offers a reload, saying so when the
 * connection came back while it was open. The offline page says it all itself, so it has no strip.
 */
export function OfflineBanner() {
  const { m } = useI18n();
  const online = useOnline();
  const fromCache = useServedFromCache();
  const path = splitLocale(usePathname() ?? "/").path;
  const [cameBack, setCameBack] = useState(false);
  useEffect(() => {
    const onOnline = () => setCameBack(true);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);
  if ((online && !fromCache) || path === "/offline") return null;
  const message = path === "/plan" ? m.pwa.offlinePlan : fromCache ? m.pwa.offlinePage : m.pwa.offlineNow;
  return (
    <div role="status" className="border-b border-warn bg-paper-raised print:hidden">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 md:px-8">
        <WifiOff aria-hidden className="size-4 shrink-0 text-warn" />
        <p className="text-caption text-ink">{message}</p>
        {fromCache && online ? (
          <p className="text-caption text-ink">
            {cameBack ? `${m.pwa.backOnline} ` : null}
            <button type="button" onClick={() => window.location.reload()} className="font-medium text-accent underline">
              {m.pwa.reload}
            </button>
          </p>
        ) : null}
      </div>
    </div>
  );
}
