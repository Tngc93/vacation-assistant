import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses, Caption } from "@/components/ui";
import { localePath, type Locale } from "@/i18n/locales";
import { getI18n } from "@/i18n/server";

export function notFoundMetadata(locale: Locale): Metadata {
  return { title: getI18n(locale).m.notFound.title, robots: { index: false } };
}

export function NotFound({ locale }: { locale: Locale }) {
  const { m } = getI18n(locale);
  return (
    <section aria-labelledby="not-found-title" className="mx-auto w-full max-w-6xl px-4 pb-24 pt-14 md:px-8 md:pt-24">
      <Caption as="p">{m.notFound.caption}</Caption>
      <h1 id="not-found-title" className="mt-4 max-w-2xl font-display text-headline text-ink">
        {m.notFound.heading}
      </h1>
      <Link href={localePath(locale, "/")} className={buttonClasses({ variant: "secondary", className: "mt-10 no-underline" })}>
        {m.notFound.home}
      </Link>
    </section>
  );
}
