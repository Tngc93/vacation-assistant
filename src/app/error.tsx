"use client";

import Link from "next/link";
import { buttonClasses, Caption } from "@/components/ui";

/** Shown inside the site's header and footer when a page fails to render. */
export default function ErrorPage() {
  return (
    <section aria-labelledby="error-title" className="mx-auto w-full max-w-6xl px-4 pb-24 pt-14 md:px-8 md:pt-24">
      <Caption as="p">Bir sorun çıktı</Caption>
      <h1 id="error-title" className="mt-4 max-w-2xl font-display text-headline text-ink">
        Bu sayfa şu an açılamadı; birazdan yeniden dene.
      </h1>
      <Link href="/" className={buttonClasses({ variant: "secondary", className: "mt-10 no-underline" })}>
        Ana sayfaya dön
      </Link>
    </section>
  );
}
