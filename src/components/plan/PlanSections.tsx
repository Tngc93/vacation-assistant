import { Suspense, type ReactNode } from "react";
import { Caption } from "@/components/ui";
import { findDestination } from "@/data/destinations";
import { findOrigin } from "@/data/origins";
import { daysBetween } from "@/lib/search/dates";
import type { SearchState } from "@/lib/search/params";
import { RateLine, RateLineFallback } from "./RateLine";
import { VisaCard } from "./VisaCard";

type Section = { id: string; title: string; status?: string; body: ReactNode };

function Placeholder({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-rule px-5 py-6 md:px-8">
      <p className="max-w-2xl text-body text-ink-muted">{text}</p>
      {children}
      <Caption as="p" className="mt-3">
        Henüz veri yok
      </Caption>
    </div>
  );
}

function sectionsFor(search: SearchState): Section[] {
  const origin = findOrigin(search.from)!;
  const destination = findDestination(search.to)!;
  const days = daysBetween(search.depart, search.return) + 1;
  return [
    {
      id: "ucuslar",
      title: "Uçuşlar",
      status: "Yakında",
      body: (
        <Placeholder
          text={`${origin.airports.join(" ve ")} çıkışlı ${destination.cityCode} uçuşları, kaynağı ve "tahmini" etiketiyle burada listelenecek.`}
        />
      ),
    },
    { id: "vize", title: "Vize", body: <VisaCard destination={destination} /> },
    {
      id: "butce",
      title: "Bütçe",
      status: "Yakında",
      body: (
        <Placeholder text="Uçuş, konaklama ve günlük harcamanın TL toplamı, her satırın kaynağıyla birlikte burada olacak.">
          {destination.currency !== "TRY" ? (
            <div className="mt-4">
              <Caption as="p">Hesapta kullanılacak kur</Caption>
              <Suspense fallback={<RateLineFallback className="mt-2" />}>
                <RateLine currency={destination.currency} className="mt-1" />
              </Suspense>
            </div>
          ) : null}
        </Placeholder>
      ),
    },
    {
      id: "sehir-rehberi",
      title: "Şehir rehberi",
      status: "Yakında",
      body: (
        <Placeholder text="Görülecek yerler, restoranlar ve akşam mekânları OpenStreetMap verisiyle, harita üzerinde burada olacak." />
      ),
    },
    {
      id: "gun-gun-plan",
      title: "Gün gün plan",
      status: "Yakında",
      body: <Placeholder text={`${days} günlük rota, yakın duraklar aynı güne düşecek şekilde burada kurulacak.`} />,
    },
  ];
}

/** The plan's sections. Visa is live; the rest say what is coming without showing data. */
export function PlanSections({ search }: { search: SearchState }) {
  return (
    <div className="mt-16 grid gap-12 md:mt-20 md:gap-16">
      {sectionsFor(search).map((section) => (
        <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`}>
          <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-3">
            <h2 id={`${section.id}-title`} className="font-display text-title">
              {section.title}
            </h2>
            {section.status ? <Caption tone="accent">{section.status}</Caption> : null}
          </div>
          <div className="mt-5">{section.body}</div>
        </section>
      ))}
    </div>
  );
}
