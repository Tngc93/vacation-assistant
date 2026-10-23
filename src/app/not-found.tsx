import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses, Caption } from "@/components/ui";

export const metadata: Metadata = {
  title: "Sayfa bulunamadı",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <section aria-labelledby="not-found-title" className="mx-auto w-full max-w-6xl px-4 pb-24 pt-14 md:px-8 md:pt-24">
      <Caption as="p">404 · Sayfa bulunamadı</Caption>
      <h1 id="not-found-title" className="mt-4 max-w-2xl font-display text-headline text-ink">
        Aradığın sayfa bu haritada yok.
      </h1>
      <Link href="/" className={buttonClasses({ variant: "secondary", className: "mt-10 no-underline" })}>
        Ana sayfaya dön
      </Link>
    </section>
  );
}
