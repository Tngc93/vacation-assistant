import { Fragment, Suspense, type ReactNode } from "react";
import { AiDrawerProvider, AiEdgeTab, AiTabButton } from "@/components/ai/AiDrawer";
import { Caption } from "@/components/ui";
import { findDestination } from "@/data/destinations";
import type { SearchState } from "@/lib/search/params";
import { BudgetCurrencyPicker } from "@/components/budget/BudgetCurrencyPicker";
import { BudgetSection, BudgetSkeleton } from "@/components/budget/BudgetSection";
import { FlightsSection, FlightsSkeleton } from "@/components/flights/FlightsSection";
import { ItinerarySection, ItinerarySkeleton } from "@/components/itinerary/ItinerarySection";
import { StaysSection, StaysSkeleton } from "@/components/stays/StaysSection";
import { parseBudgetCurrency } from "@/lib/budget/currency";
import type { BudgetParams } from "@/lib/budget/params";
import type { CategoryId } from "@/lib/places/categories";
import type { EditBatch } from "@/lib/ai/edits";
import { VisaCard } from "./VisaCard";

/**
 * Visa (PRD 11–12) is out of the phase 1 page (2026-10-21, Berk's decision); the data and VisaCard stay in the
 * code. Set to true to bring the section back.
 */
const SHOW_VISA = false;

/**
 * `print: false` leaves a section out of the printed plan; `action` sits right of the title (under it on phones);
 * `aiDrawer` shares the AI panel's open state between the section's tabs and the plan.
 */
type Section = { id: string; title: string; lead?: string; status?: string; action?: ReactNode; aiDrawer?: true; body: ReactNode; print?: false };

/** The plan's own URL state: `?skip=`, `?ai=` and `?edit=`. */
export type PlanEdits = { skip: string[]; ai: string[][] | null; edits: EditBatch[] };

function sectionsFor(search: SearchState, categories: CategoryId[], direct: boolean, budget: BudgetParams, planEdits: PlanEdits): Section[] {
  const destination = findDestination(search.to)!;
  return [
    {
      id: "gun-gun-plan",
      title: "Gün gün plan",
      action: <AiTabButton />,
      aiDrawer: true,
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
      id: "konaklama",
      title: "Konaklama",
      print: false,
      body: (
        <Suspense fallback={<StaysSkeleton />}>
          <StaysSection search={search} destination={destination} />
        </Suspense>
      ),
    },
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
            webFlight={budget.webFlight}
          />
        </Suspense>
      ),
    },
    {
      id: "butce",
      title: "Bütçe",
      lead: "Seçtiğin uçuş, konaklama ve günlük harcamanın toplamı.",
      action: <BudgetCurrencyPicker fromLink={parseBudgetCurrency(budget.cur)} />,
      body: (
        <Suspense fallback={<BudgetSkeleton />}>
          <BudgetSection search={search} destination={destination} direct={direct} budget={budget} />
        </Suspense>
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
      {sectionsFor(search, categories, direct, budget, planEdits).map((section) => {
        const Wrap = section.aiDrawer ? AiDrawerProvider : Fragment;
        return (
          <Wrap key={section.id}>
            <section
              id={section.id}
              aria-labelledby={`${section.id}-title`}
              className={section.print === false ? "scroll-mt-16 print:hidden" : "scroll-mt-16"}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-3 border-b border-rule pb-3">
                <h2 id={`${section.id}-title`} className="font-display text-title">
                  {section.title}
                </h2>
                {section.status ? <Caption tone="accent">{section.status}</Caption> : null}
                {section.action ? <div className="basis-full lg:basis-auto">{section.action}</div> : null}
              </div>
              {section.lead ? <p className="mt-3 text-body text-ink-muted print:hidden">{section.lead}</p> : null}
              <div className="mt-5">{section.body}</div>
              {section.aiDrawer ? <AiEdgeTab sectionId={section.id} /> : null}
            </section>
          </Wrap>
        );
      })}
    </div>
  );
}
