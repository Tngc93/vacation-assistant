import type { Metadata, Viewport } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { cn } from "@/lib/cn";
import { themeInitScript } from "@/lib/theme";
import { fraunces, geist, geistMono } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Vacation Assistant",
    template: "%s · Vacation Assistant",
  },
  description: "Türkiye'den yola çıkanlar için tatil asistanı: en ucuz uçuş, vize, TL bütçe ve gün gün şehir planı.",
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
      </body>
    </html>
  );
}
