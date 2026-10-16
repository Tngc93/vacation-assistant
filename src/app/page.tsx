import { Suspense } from "react";
import { Caption } from "@/components/ui";
import { SearchForm } from "@/components/search/SearchForm";
import { SearchFormFromUrl } from "@/components/search/SearchFormFromUrl";

export default function HomePage() {
  return (
    <section aria-labelledby="hero-title" className="mx-auto w-full max-w-6xl px-4 pb-16 pt-12 md:px-8 md:pb-24 md:pt-20">
      <Caption as="p">Türkiye çıkışlı tatil planlayıcısı</Caption>
      <h1 id="hero-title" className="mt-4 max-w-3xl font-display text-display text-ink">
        Nereye uçuyoruz?
      </h1>
      <p className="mt-5 max-w-xl text-body text-ink-muted">
        En ucuz uçuş, vize durumu, TL bütçe ve gün gün şehir planı. Hepsi tek bir biletin üzerinde.
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
