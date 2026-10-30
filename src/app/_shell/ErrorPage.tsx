"use client";

import Link from "next/link";
import { buttonClasses, Caption } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { localePath } from "@/i18n/locales";

/** Shown inside the site's header and footer when a page fails to render. */
export function ErrorPage() {
  const { locale, m } = useI18n();
  return (
    <section aria-labelledby="error-title" className="mx-auto w-full max-w-6xl px-4 pb-24 pt-14 md:px-8 md:pt-24">
      <Caption as="p">{m.error.caption}</Caption>
      <h1 id="error-title" className="mt-4 max-w-2xl font-display text-headline text-ink">
        {m.error.heading}
      </h1>
      <Link href={localePath(locale, "/")} className={buttonClasses({ variant: "secondary", className: "mt-10 no-underline" })}>
        {m.error.home}
      </Link>
    </section>
  );
}
