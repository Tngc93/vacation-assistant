import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { OfflineBanner } from "@/components/pwa/OfflineBanner";
import { PwaClient } from "@/components/pwa/PwaClient";
import { SiteAnalytics } from "@/components/SiteAnalytics";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { I18nProvider } from "@/i18n/client";
import { OG_LOCALE, type Locale } from "@/i18n/locales";
import { getI18n, MESSAGES } from "@/i18n/server";
import { analyticsEnabled } from "@/lib/analytics";
import { BRAND_NAME, SITE_URL } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { APP_ICONS, manifestPath } from "@/lib/pwa/manifest";
import { THEME_TOKENS } from "@/lib/pwa/theme";
import { themeInitScript } from "@/lib/theme";
import { fraunces, geist, geistMono } from "../fonts";
import "../globals.css";

/** The root metadata of a language: its description and Open Graph locale. */
export function rootMetadata(locale: Locale): Metadata {
  const { m } = getI18n(locale);
  return {
    // Open Graph images and the canonical address become absolute URLs on this origin.
    metadataBase: new URL(SITE_URL),
    applicationName: BRAND_NAME,
    title: {
      default: BRAND_NAME,
      template: `%s · ${BRAND_NAME}`,
    },
    description: m.brand.description,
    // Each language installs as its own app (src/lib/pwa/manifest.ts).
    manifest: manifestPath(locale),
    icons: { apple: APP_ICONS.apple180 },
    appleWebApp: { capable: true, title: BRAND_NAME, statusBarStyle: "default" },
    openGraph: { type: "website", locale: OG_LOCALE[locale], siteName: BRAND_NAME, title: BRAND_NAME, description: m.brand.description },
    twitter: { card: "summary_large_image", title: BRAND_NAME, description: m.brand.description },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The browser's and the installed app's bars take the page's paper, light or dark (globals.css).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_TOKENS.light.paper },
    { media: "(prefers-color-scheme: dark)", color: THEME_TOKENS.dark.paper },
  ],
};

/**
 * The document of both root layouts ((tr)/layout.tsx and en/layout.tsx): `<html lang>`, the theme, the site's
 * header and footer, and the language's messages for client components.
 */
export function RootDocument({ locale, children }: { locale: Locale; children: ReactNode }) {
  const { m } = getI18n(locale);
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn(fraunces.variable, geist.variable, geistMono.variable)}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <I18nProvider locale={locale} messages={MESSAGES[locale]}>
          <a
            href="#icerik"
            className="sr-only rounded-sm bg-ink px-3 py-2 text-paper-raised focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60]"
          >
            {m.shell.skipToContent}
          </a>
          <SiteHeader locale={locale} />
          <OfflineBanner />
          <main id="icerik" className="flex-1">
            {children}
          </main>
          <SiteFooter locale={locale} />
          <PwaClient />
        </I18nProvider>
        {analyticsEnabled() ? <SiteAnalytics /> : null}
      </body>
    </html>
  );
}
