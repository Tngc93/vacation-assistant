import { Suspense } from "react";
import { Caption } from "@/components/ui";
import { SearchForm } from "@/components/search/SearchForm";
import { SearchFormFromUrl } from "@/components/search/SearchFormFromUrl";
import { BRAND_TAGLINE } from "@/lib/brand";

export default function HomePage() {
  return (
    <section
      aria-labelledby="hero-title"
      // On desktop the hero sits a little above the middle of the first screen (under the site header).
      className="mx-auto flex w-full max-w-6xl flex-col px-4 pb-20 pt-14 md:min-h-[calc(100svh-4rem-1px)] md:justify-center md:px-8 md:pb-40 md:pt-16"
    >
      <Caption as="p">{BRAND_TAGLINE}</Caption>
      <h1 id="hero-title" className="mt-4 max-w-3xl font-display text-display text-ink">
        Nereye gidiyorsun?
      </h1>
      <p className="mt-5 max-w-xl text-body text-ink-muted">
        Şehri ve günleri seç; görülecek yerler, gün gün plan, konaklama, uçuş ve TL bütçe tek sayfada.
      </p>
      <div className="mt-10 md:mt-14">
        {/* The empty form is the static shell; the URL-aware form replaces it on the client. */}
        <Suspense fallback={<SearchForm />}>
          <SearchFormFromUrl />
        </Suspense>
      </div>
    </section>
  );
}
