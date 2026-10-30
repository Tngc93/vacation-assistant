import type { Metadata } from "next";
import Link from "next/link";
import { RetryButton } from "@/components/pwa/RetryButton";
import { SavedPlans } from "@/components/pwa/SavedPlans";
import { buttonClasses, Caption } from "@/components/ui";
import { localePath, type Locale } from "@/i18n/locales";
import { getI18n } from "@/i18n/server";

export function offlineMetadata(locale: Locale): Metadata {
  return { title: getI18n(locale).m.offline.title, robots: { index: false } };
}

/**
 * What the service worker shows offline for a page it never saved (public/sw.js redirects here with `?from=`):
 * one calm sentence, "Yeniden dene", and the plans saved on this device. Static, saved at install.
 */
export function OfflinePage({ locale }: { locale: Locale }) {
  const { m } = getI18n(locale);
  return (
    <section aria-labelledby="offline-title" className="mx-auto w-full max-w-6xl px-4 pb-24 pt-14 md:px-8 md:pt-24">
      <Caption as="p">{m.offline.caption}</Caption>
      <h1 id="offline-title" className="mt-4 max-w-2xl font-display text-headline text-ink">
        {m.offline.heading}
      </h1>
      <p className="mt-4 max-w-xl text-body text-ink-muted">{m.offline.lead}</p>
      <div className="mt-10 flex flex-wrap gap-3">
        <RetryButton />
        <Link href={localePath(locale, "/")} className={buttonClasses({ variant: "secondary", className: "no-underline" })}>
          {m.offline.home}
        </Link>
      </div>
      <SavedPlans />
    </section>
  );
}
