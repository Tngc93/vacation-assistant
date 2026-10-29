import type { Metadata } from "next";
import { Suspense } from "react";
import { Caption } from "@/components/ui";
import { SearchForm } from "@/components/search/SearchForm";
import { SearchFormFromUrl } from "@/components/search/SearchFormFromUrl";
import { languageAlternates } from "@/i18n/alternates";
import type { Locale } from "@/i18n/locales";
import { getI18n } from "@/i18n/server";

export function homeMetadata(locale: Locale): Metadata {
  return { alternates: languageAlternates(locale, "/") };
}

export function HomePage({ locale }: { locale: Locale }) {
  const { m } = getI18n(locale);
  return (
    <section
      aria-labelledby="hero-title"
      // On desktop the hero sits a little above the middle of the first screen (under the site header).
      className="mx-auto flex w-full max-w-6xl flex-col px-4 pb-20 pt-14 md:min-h-[calc(100svh-4rem-1px)] md:justify-center md:px-8 md:pb-40 md:pt-16"
    >
      <Caption as="p">{m.brand.tagline}</Caption>
      <h1 id="hero-title" className="mt-4 max-w-3xl font-display text-display text-ink">
        {m.home.title}
      </h1>
      <p className="mt-5 max-w-xl text-body text-ink-muted">{m.home.lead}</p>
      <div className="mt-10 md:mt-14">
        {/* The empty form is the static shell; the URL-aware form replaces it on the client. */}
        <Suspense fallback={<SearchForm />}>
          <SearchFormFromUrl />
        </Suspense>
      </div>
    </section>
  );
}
