import { Suspense, type ReactNode } from "react";
import { Caption } from "@/components/ui";
import { findDestination } from "@/data/destinations";
import { daysBetween } from "@/lib/search/dates";
import type { SearchState } from "@/lib/search/params";
import { BudgetSection, BudgetSkeleton } from "@/components/budget/BudgetSection";
import { FlightsSection, FlightsSkeleton } from "@/components/flights/FlightsSection";
import { StayCard } from "@/components/stays/StayCard";
import type { BudgetParams } from "@/lib/budget/params";
import { CityGuide, CityGuideSkeleton } from "@/components/places/CityGuide";
import type { CategoryId } from "@/lib/places/categories";
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

function sectionsFor(search: SearchState, categories: CategoryId[], direct: boolean, budget: BudgetParams): Section[] {
  const destination = findDestination(search.to)!;
  const days = daysBetween(search.depart, search.return) + 1;
  return [
    {
      id: "ucuslar",
      title: "Uçuşlar",
      body: (
        <Suspense fallback={<FlightsSkeleton />}>
          <FlightsSection
            from={search.from}
            to={search.to}
            depart={search.depart}
            return={search.return}
            pax={search.pax}
            direct={direct}
            flight={budget.flight}
          />
        </Suspense>
      ),
    },
    { id: "vize", title: "Vize", body: <VisaCard destination={destination} /> },
    {
      id: "konaklama",
      title: "Konaklama",
      body: <StayCard destination={destination} checkIn={search.depart} checkOut={search.return} adults={search.pax} />,
    },
    {
      id: "butce",
      title: "Bütçe",
      body: (
        <Suspense fallback={<BudgetSkeleton />}>
          <BudgetSection search={search} destination={destination} direct={direct} budget={budget} />
        </Suspense>
      ),
    },
    {
      id: "sehir-rehberi",
      title: "Şehir rehberi",
      body: (
        <Suspense fallback={<CityGuideSkeleton />}>
          <CityGuide destination={destination} categories={categories} />
        </Suspense>
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

/** The plan's sections. Everything but the day-by-day plan is live; that one says what is coming without showing data. */
export function PlanSections({
  search,
  categories,
  direct,
  budget,
}: {
  search: SearchState;
  categories: CategoryId[];
  direct: boolean;
  budget: BudgetParams;
}) {
  return (
    <div className="mt-16 grid gap-12 md:mt-20 md:gap-16">
      {sectionsFor(search, categories, direct, budget).map((section) => (
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
