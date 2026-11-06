import { Fragment, Suspense, type ReactNode } from "react";
import { AiDrawerProvider, AiEdgeTab, AiTabButton } from "@/components/ai/AiDrawer";
import { Caption } from "@/components/ui";
import { cn } from "@/lib/cn";
import { findDestination } from "@/data/destinations";
import type { Locale } from "@/i18n/locales";
import { getI18n } from "@/i18n/server";
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
import { degreesMinutes } from "@/lib/plan-background/coordinates";
import { SectionGap } from "./SectionGap";
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

function sectionsFor(
  locale: Locale,
  search: SearchState,
  categories: CategoryId[],
  direct: boolean,
  budget: BudgetParams,
  planEdits: PlanEdits,
): Section[] {
  const { m } = getI18n(locale);
  const destination = findDestination(search.to)!;
  return [
    {
      id: "gun-gun-plan",
      title: m.plan.itinerary,
      action: <AiTabButton />,
      aiDrawer: true,
      body: (
        <Suspense fallback={<ItinerarySkeleton locale={locale} />}>
          <ItinerarySection
            locale={locale}
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
    ...(SHOW_VISA ? [{ id: "vize", title: m.plan.visa, body: <VisaCard destination={destination} locale={locale} /> }] : []),
    {
      id: "konaklama",
      title: m.plan.stays,
      print: false,
      body: (
        <Suspense fallback={<StaysSkeleton locale={locale} />}>
          <StaysSection locale={locale} search={search} destination={destination} />
        </Suspense>
      ),
    },
    {
      id: "ucuslar",
      title: m.plan.flights,
      body: (
        <Suspense fallback={<FlightsSkeleton locale={locale} />}>
          <FlightsSection
            locale={locale}
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
      title: m.plan.budget,
      lead: m.plan.budgetLead,
      action: <BudgetCurrencyPicker fromLink={parseBudgetCurrency(budget.cur)} />,
      body: (
        <Suspense fallback={<BudgetSkeleton locale={locale} />}>
          <BudgetSection locale={locale} search={search} destination={destination} direct={direct} budget={budget} />
        </Suspense>
      ),
    },
  ];
}

/** The plan's sections under the hero. */
export function PlanSections({
  locale,
  search,
  categories,
  direct,
  budget,
  planEdits,
}: {
  locale: Locale;
  search: SearchState;
  categories: CategoryId[];
  direct: boolean;
  budget: BudgetParams;
  /** `?skip=`, `?ai=`, `?edit=`: the day-by-day plan's removals, AI plan and chat edits. */
  planEdits: PlanEdits;
}) {
  const i18n = getI18n(locale);
  const destination = findDestination(search.to)!;
  // The gaps between the sections carry the city's coordinate, latitude and longitude in turn (DESIGN.md "Plan
  // background"): the Wikidata point the masthead names.
  const gapLabel = (i: number) =>
    i % 2 === 0 ? degreesMinutes(destination.lat, "lat", i18n) : degreesMinutes(destination.lon, "lon", i18n);
  return (
    <div className="mt-12 grid md:mt-16">
      {sectionsFor(locale, search, categories, direct, budget, planEdits).map((section, i) => {
        const Wrap = section.aiDrawer ? AiDrawerProvider : Fragment;
        return (
          <Wrap key={section.id}>
            {i > 0 ? <SectionGap label={gapLabel(i - 1)} /> : null}
            <section
              id={section.id}
              aria-labelledby={`${section.id}-title`}
              data-plan-section=""
              className={cn(
                // A card over the atmosphere (DESIGN.md "Plan background"); plain paper again in print. Inside it
                // nothing else is framed except objects (`data-object-card`: tickets, the receipt, web results, maps),
                // and a ticket's notches show the card's paper.
                "scroll-mt-16 rounded-md border border-rule bg-paper-raised p-4 shadow-ticket [--ticket-notch:var(--paper-raised)] md:p-8",
                "print:rounded-none print:border-0 print:bg-transparent print:p-0 print:shadow-none",
                section.print === false && "print:hidden",
              )}
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
