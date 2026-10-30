import { Skeleton } from "@/components/ui";
import type { Destination } from "@/data/destinations";
import type { I18n } from "@/i18n/i18n";
import type { Locale } from "@/i18n/locales";
import { getI18n } from "@/i18n/server";
import { airlineName } from "@/data/airlines";
import type { BudgetParams } from "@/lib/budget/params";
import type { FlightLine } from "@/lib/budget/receipt";
import { loadFlights } from "@/lib/flights/load";
import type { FlightsResult } from "@/lib/flights/search";
import { chooseFlight, type FlightChoice } from "@/lib/flights/select";
import { loadRateTable } from "@/lib/rates/table";
import { daysBetween } from "@/lib/search/dates";
import type { SearchState } from "@/lib/search/params";
import { BudgetReceipt } from "./BudgetReceipt";

type Props = { locale: Locale; search: SearchState; destination: Destination; direct: boolean; budget: BudgetParams };

/** What the flight row shows for a choice, in the interface language; never a made-up price. */
export function flightLineFor(choice: FlightChoice, result: FlightsResult, { locale, m }: Pick<I18n, "locale" | "m"> = getI18n("tr")): FlightLine {
  const r = m.budget.reasons;
  const sample = result.status === "ok" && result.fixture;
  if (choice.status === "none") {
    return {
      kind: "missing",
      reason:
        result.status === "unavailable"
          ? result.reason === "no-token"
            ? r.noToken
            : result.reason === "same-city"
              ? r.sameCity
              : r.down
          : r.noneCached,
    };
  }
  if (!choice.ticket) return { kind: "missing", reason: r.gone };
  const t = choice.ticket;
  return {
    kind: "ticket",
    label: `${airlineName(t.airline, locale)} · ${t.airline} ${t.flightNumber} · ${t.originAirport} → ${t.destinationAirport}`,
    pricePerAdult: t.pricePerAdult,
    differentDates: t.differentDates,
    sample,
    note:
      choice.status === "selected-missing" ? m.budget.notes.selectedMissing : choice.status === "cheapest" ? m.budget.notes.cheapest : null,
  };
}

/**
 * Budget receipt (PRD 13–15): the flight from the cached prices, the rest from what the person enters, all in
 * the currency chosen in the header (TRY, EUR, USD, GBP).
 */
export async function BudgetSection({ locale, search, destination, direct, budget }: Props) {
  // The destination's own currency too: older links entered amounts in it (`?cur=CZK`).
  const [result, rates] = await Promise.all([
    loadFlights(search.from, search.to, search.depart, search.return, search.pax, direct),
    loadRateTable(destination.currency),
  ]);
  const nights = daysBetween(search.depart, search.return);
  const flight: FlightLine = budget.webFlight
    ? { kind: "web", host: budget.webFlight.host, perAdult: budget.webFlight.perAdult }
    : flightLineFor(chooseFlight(result, budget.flight), result, getI18n(locale));
  return (
    <BudgetReceipt
      initial={budget}
      flight={flight}
      rates={rates}
      nights={nights}
      days={nights + 1}
      pax={search.pax}
    />
  );
}

export function BudgetSkeleton({ locale }: { locale: Locale }) {
  return (
    <div aria-busy="true" className="grid gap-3 rounded-md border border-rule bg-paper-raised p-5 md:p-8">
      <span className="sr-only">{getI18n(locale).m.budget.loading}</span>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-5 w-full" />
      ))}
      <Skeleton className="mt-4 h-8 w-1/2" />
    </div>
  );
}
