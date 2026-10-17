import { Suspense, type ReactNode } from "react";
import { Caption } from "@/components/ui";
import { findDestination } from "@/data/destinations";
import type { SearchState } from "@/lib/search/params";
import { BudgetSection, BudgetSkeleton } from "@/components/budget/BudgetSection";
import { FlightsSection, FlightsSkeleton } from "@/components/flights/FlightsSection";
import { ItinerarySection, ItinerarySkeleton } from "@/components/itinerary/ItinerarySection";
import { StayCard } from "@/components/stays/StayCard";
import type { BudgetParams } from "@/lib/budget/params";
import { CityGuide, CityGuideSkeleton } from "@/components/places/CityGuide";
import type { CategoryId } from "@/lib/places/categories";
import { VisaCard } from "./VisaCard";

type Section = { id: string; title: string; status?: string; body: ReactNode };

function sectionsFor(search: SearchState, categories: CategoryId[], direct: boolean, budget: BudgetParams, skip: string[]): Section[] {
  const destination = findDestination(search.to)!;
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
      body: (
        <Suspense fallback={<ItinerarySkeleton />}>
          <ItinerarySection
            search={search}
            destination={destination}
            categories={categories}
            direct={direct}
            flight={budget.flight}
            skip={skip}
          />
        </Suspense>
      ),
    },
  ];
}

/** The plan's sections. */
export function PlanSections({
  search,
  categories,
  direct,
  budget,
  skip,
}: {
  search: SearchState;
  categories: CategoryId[];
  direct: boolean;
  budget: BudgetParams;
  /** `?skip=`: stops removed from the day-by-day plan. */
  skip: string[];
}) {
  return (
    <div className="mt-16 grid gap-12 md:mt-20 md:gap-16">
      {sectionsFor(search, categories, direct, budget, skip).map((section) => (
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
