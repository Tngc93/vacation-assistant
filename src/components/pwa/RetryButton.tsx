"use client";

import { Button } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { retryTarget } from "@/lib/pwa/sw";

/** "Yeniden dene": back to the page the service worker could not open (`?from=`), with a full page load. */
export function RetryButton() {
  const { m, locale } = useI18n();
  return (
    <Button onClick={() => window.location.assign(retryTarget(window.location.search, locale))}>{m.offline.retry}</Button>
  );
}
