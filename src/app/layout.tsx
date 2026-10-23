import type { Metadata, Viewport } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { BRAND_DESCRIPTION, BRAND_NAME, SITE_URL } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { themeInitScript } from "@/lib/theme";
import { fraunces, geist, geistMono } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  // Open Graph images and the canonical address become absolute URLs on this origin.
  metadataBase: new URL(SITE_URL),
  applicationName: BRAND_NAME,
  title: {
    default: BRAND_NAME,
    template: `%s · ${BRAND_NAME}`,
  },
  description: BRAND_DESCRIPTION,
  openGraph: { type: "website", locale: "tr_TR", siteName: BRAND_NAME, title: BRAND_NAME, description: BRAND_DESCRIPTION },
  twitter: { card: "summary_large_image", title: BRAND_NAME, description: BRAND_DESCRIPTION },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      suppressHydrationWarning
      className={cn(fraunces.variable, geist.variable, geistMono.variable)}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#icerik"
          className="sr-only rounded-sm bg-ink px-3 py-2 text-paper-raised focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60]"
        >
          İçeriğe geç
        </a>
        <SiteHeader />
        <main id="icerik" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
