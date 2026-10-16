import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vacation Assistant",
  description: "Türkiye'den yola çıkanlar için tatil asistanı: en ucuz uçuş, vize, TL bütçe ve gün gün şehir planı.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
