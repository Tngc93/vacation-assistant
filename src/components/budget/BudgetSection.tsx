import { Skeleton } from "@/components/ui";
import type { Destination } from "@/data/destinations";
import { airlineName } from "@/data/airlines";
import type { BudgetParams } from "@/lib/budget/params";
import type { FlightLine, RateInfo } from "@/lib/budget/receipt";
import { loadFlights } from "@/lib/flights/load";
import type { FlightsResult } from "@/lib/flights/search";
import { chooseFlight, type FlightChoice } from "@/lib/flights/select";
import { getRate } from "@/lib/rates";
import { daysBetween } from "@/lib/search/dates";
import type { SearchState } from "@/lib/search/params";
import { BudgetReceipt } from "./BudgetReceipt";

type Props = { search: SearchState; destination: Destination; direct: boolean; budget: BudgetParams };

/** What the flight row shows for a choice; never a made-up price. */
export function flightLineFor(choice: FlightChoice, result: FlightsResult): FlightLine {
  const sample = result.status === "ok" && result.fixture;
  if (choice.status === "none") {
    return {
      kind: "missing",
      reason:
        result.status === "unavailable"
          ? result.reason === "no-token"
            ? "TRAVELPAYOUTS BAĞLANTISI YOK"
            : "TRAVELPAYOUTS ŞU AN CEVAP VERMİYOR"
          : "SEÇİLEN TARİHLERDE ÖNBELLEKTE UÇUŞ YOK",
    };
  }
  if (!choice.ticket) return { kind: "missing", reason: "SEÇTİĞİN BİLET ARTIK ÖNBELLEKTE YOK" };
  const t = choice.ticket;
  return {
    kind: "ticket",
    label: `${airlineName(t.airline)} · ${t.airline} ${t.flightNumber} · ${t.originAirport} → ${t.destinationAirport}`,
    pricePerAdult: t.pricePerAdult,
    differentDates: t.differentDates,
    sample,
    note:
      choice.status === "selected-missing"
        ? "Seçtiğin bilet artık önbellekte yok; seçilen tarihlerdeki en ucuz bilet kullanıldı."
        : choice.status === "cheapest"
          ? "Seçilen tarihlerdeki en ucuz bilet. Başka bir bileti uçuş kartındaki “Bütçeye ekle” ile seçebilirsin."
          : null,
  };
}

/** Budget receipt (PRD 13, 15): the flight from the cached prices, the rest from what the person enters. */
export async function BudgetSection({ search, destination, direct, budget }: Props) {
  const [result, rateResult] = await Promise.all([
    loadFlights(search.from, search.to, search.depart, search.return, search.pax, direct),
    destination.currency === "TRY" ? null : getRate(destination.currency),
  ]);
  const rate: RateInfo | null = rateResult
    ? rateResult.ok
      ? {
          ok: true,
          currency: rateResult.currency,
          tryPerUnit: rateResult.tryPerUnit,
          sourceId: rateResult.source.id,
          sourceName: rateResult.source.name,
          date: rateResult.date,
        }
      : { ok: false, currency: rateResult.currency }
    : null;
  const nights = daysBetween(search.depart, search.return);
  const flight: FlightLine = budget.webFlight
    ? { kind: "web", host: budget.webFlight.host, perAdult: budget.webFlight.perAdult }
    : flightLineFor(chooseFlight(result, budget.flight), result);
  return (
    <BudgetReceipt
      initial={budget}
      flight={flight}
      rate={rate}
      localCurrency={destination.currency}
      nights={nights}
      days={nights + 1}
      pax={search.pax}
    />
  );
}

export function BudgetSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-3 rounded-md border border-rule bg-paper-raised p-5 md:p-8">
      <span className="sr-only">Bütçe yükleniyor</span>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-5 w-full" />
      ))}
      <Skeleton className="mt-4 h-8 w-1/2" />
    </div>
  );
}
