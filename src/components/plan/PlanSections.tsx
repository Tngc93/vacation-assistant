import { Suspense, type ReactNode } from "react";
import { Caption } from "@/components/ui";
import { findDestination } from "@/data/destinations";
import type { SearchState } from "@/lib/search/params";
import { BudgetSection, BudgetSkeleton } from "@/components/budget/BudgetSection";
import { FlightsSection, FlightsSkeleton } from "@/components/flights/FlightsSection";
import { ItinerarySection, ItinerarySkeleton } from "@/components/itinerary/ItinerarySection";
import { StayCard } from "@/components/stays/StayCard";
import { WebStaySection } from "@/components/stays/WebStaySection";
import type { BudgetParams } from "@/lib/budget/params";
import type { CategoryId } from "@/lib/places/categories";
import type { EditBatch } from "@/lib/ai/edits";
import { VisaCard } from "./VisaCard";

/**
 * Visa (PRD 11–12) is out of the phase 1 page (2026-10-21, Berk's decision); the data and VisaCard stay in the
 * code. Set to true to bring the section back.
 */
const SHOW_VISA = false;

/** `print: false` leaves a section out of the printed plan. */
type Section = { id: string; title: string; lead?: string; status?: string; body: ReactNode; print?: false };

/** The plan's own URL state: `?skip=`, `?ai=` and `?edit=`. */
export type PlanEdits = { skip: string[]; ai: string[][] | null; edits: EditBatch[] };

function sectionsFor(search: SearchState, categories: CategoryId[], direct: boolean, budget: BudgetParams, planEdits: PlanEdits): Section[] {
  const destination = findDestination(search.to)!;
  return [
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
            webFlight={budget.webFlight !== null}
            skip={planEdits.skip}
            aiPlan={planEdits.ai}
            edits={planEdits.edits}
          />
        </Suspense>
      ),
    },
    ...(SHOW_VISA ? [{ id: "vize", title: "Vize", body: <VisaCard destination={destination} /> }] : []),
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
      id: "bilet-ve-konaklama",
      title: "Bilet ve konaklama",
      lead: "İstersen buradan da bakabilirsin.",
      body: (
        <div className="grid gap-6 md:grid-cols-2 md:items-start">
          <div id="ucuslar" className="min-w-0 scroll-mt-20 rounded-md border border-rule bg-paper-raised px-5 py-6 md:px-6 print:border-0 print:p-0">
            <h3 className="mb-4 font-display text-heading print:hidden">Uçuş</h3>
            <Suspense fallback={<FlightsSkeleton />}>
              <FlightsSection
                from={search.from}
                to={search.to}
                depart={search.depart}
                return={search.return}
                pax={search.pax}
                direct={direct}
                flight={budget.flight}
                webFlight={budget.webFlight}
              />
            </Suspense>
          </div>
          <div id="konaklama" className="min-w-0 scroll-mt-20 print:hidden">
            <StayCard destination={destination} checkIn={search.depart} checkOut={search.return} adults={search.pax}>
              <Suspense fallback={null}>
                <WebStaySection destination={destination} checkIn={search.depart} checkOut={search.return} adults={search.pax} />
              </Suspense>
            </StayCard>
          </div>
        </div>
      ),
    },
  ];
}

/** The plan's sections under the hero. */
export function PlanSections({
  search,
  categories,
  direct,
  budget,
  planEdits,
}: {
  search: SearchState;
  categories: CategoryId[];
  direct: boolean;
  budget: BudgetParams;
  /** `?skip=`, `?ai=`, `?edit=`: the day-by-day plan's removals, AI plan and chat edits. */
  planEdits: PlanEdits;
}) {
  return (
    <div className="mt-12 grid gap-16 md:mt-16 md:gap-20">
      {sectionsFor(search, categories, direct, budget, planEdits).map((section) => (
        <section
          key={section.id}
          id={section.id}
          aria-labelledby={`${section.id}-title`}
          className={section.print === false ? "scroll-mt-16 print:hidden" : "scroll-mt-16"}
        >
          <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-3">
            <h2 id={`${section.id}-title`} className="font-display text-title">
              {section.title}
            </h2>
            {section.status ? <Caption tone="accent">{section.status}</Caption> : null}
          </div>
          {section.lead ? <p className="mt-3 text-body text-ink-muted print:hidden">{section.lead}</p> : null}
          <div className="mt-5">{section.body}</div>
        </section>
      ))}
    </div>
  );
}
