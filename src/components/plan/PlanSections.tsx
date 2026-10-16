import { Caption } from "@/components/ui";
import { findDestination } from "@/data/destinations";
import { findOrigin } from "@/data/origins";
import { daysBetween } from "@/lib/search/dates";
import type { SearchState } from "@/lib/search/params";

type Section = { id: string; title: string; text: string };

function sectionsFor(search: SearchState): Section[] {
  const origin = findOrigin(search.from)!;
  const destination = findDestination(search.to)!;
  const days = daysBetween(search.depart, search.return) + 1;
  return [
    {
      id: "ucuslar",
      title: "Uçuşlar",
      text: `${origin.airports.join(" ve ")} çıkışlı ${destination.cityCode} uçuşları, kaynağı ve "tahmini" etiketiyle burada listelenecek.`,
    },
    {
      id: "vize",
      title: "Vize",
      text: `Türk pasaportuyla ${destination.countryTr} için vize durumu ve resmî bilgi linki burada görünecek.`,
    },
    {
      id: "butce",
      title: "Bütçe",
      text: "Uçuş, konaklama ve günlük harcamanın TL toplamı, her satırın kaynağıyla birlikte burada olacak.",
    },
    {
      id: "sehir-rehberi",
      title: "Şehir rehberi",
      text: "Görülecek yerler, restoranlar ve akşam mekânları OpenStreetMap verisiyle, harita üzerinde burada olacak.",
    },
    {
      id: "gun-gun-plan",
      title: "Gün gün plan",
      text: `${days} günlük rota, yakın duraklar aynı güne düşecek şekilde burada kurulacak.`,
    },
  ];
}

/** Placeholders for the steps still to come. No data is shown until a real source backs it. */
export function PlanSections({ search }: { search: SearchState }) {
  return (
    <div className="mt-16 grid gap-12 md:mt-20 md:gap-16">
      {sectionsFor(search).map((section) => (
        <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`}>
          <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-3">
            <h2 id={`${section.id}-title`} className="font-display text-title">
              {section.title}
            </h2>
            <Caption tone="accent">Yakında</Caption>
          </div>
          <div className="mt-5 rounded-md border border-dashed border-rule px-5 py-6 md:px-8">
            <p className="max-w-2xl text-body text-ink-muted">{section.text}</p>
            <Caption as="p" className="mt-3">
              Henüz veri yok
            </Caption>
          </div>
        </section>
      ))}
    </div>
  );
}
