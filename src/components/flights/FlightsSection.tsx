import { ArrowUpRight, ChevronDown } from "lucide-react";
import { Caption, SkeletonTicket } from "@/components/ui";
import { airlineName } from "@/data/airlines";
import { findDestination } from "@/data/destinations";
import { findOrigin } from "@/data/origins";
import { aiDemoEnabled } from "@/lib/ai/demo";
import type { WebFlightChoice } from "@/lib/budget/params";
import { loadRateTable } from "@/lib/rates/table";
import { AIRPORT_NAMES, cacheCaption, formatStops, formatTicketDay } from "@/lib/flights/display";
import { formatTRY } from "@/lib/format";
import { FLIGHTS_ERROR_MESSAGES } from "@/lib/flights/errors";
import { loadFlights } from "@/lib/flights/load";
import type { AirportGroup, FlightsResult } from "@/lib/flights/search";
import { choiceRef, chooseFlight } from "@/lib/flights/select";
import type { FlightTicket, Leg } from "@/lib/flights/tickets";
import { DirectChip } from "./DirectChip";
import { FlightsLinks } from "./FlightsLinks";
import { AddToBudgetButton } from "./AddToBudgetButton";
import { FlightTicketCard, type CheapestMark } from "./FlightTicketCard";
import { WebFlightSearch } from "./WebFlightSearch";

type Props = {
  from: string;
  to: string;
  depart: string;
  return: string;
  pax: number;
  direct: boolean;
  /** `?flight=`: the ticket in the budget. */
  flight: string | null;
  /** `?wf=`/`?wfs=`: a web-search price in the budget instead of a ticket. */
  webFlight: WebFlightChoice | null;
};

/** Cached Travelpayouts prices for every origin airport (server-side; the token never reaches the browser). */
export async function FlightsSection({ from, to, depart, return: ret, pax, direct, flight, webFlight }: Props) {
  const destination = findDestination(to)!;
  const [result, rates] = await Promise.all([loadFlights(from, to, depart, ret, pax, direct), loadRateTable(destination.currency)]);
  const choice = chooseFlight(result, flight);
  const query = {
    fromAirports: findOrigin(from)?.airports ?? [from],
    toCity: destination.nameEn,
    toAirports: destination.airports,
    depart,
    return: ret,
    adults: pax,
  };
  const budgetRef = webFlight ? null : choiceRef(choice);
  return (
    <>
      <div className="print:hidden">
        <CheapestByAirport result={result} budgetRef={budgetRef} />
        {/* The full list, its filter and the web search stay folded away until asked for. */}
        <details className="group mt-5 border-t border-rule pt-4">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-caption font-medium text-ink [&::-webkit-details-marker]:hidden">
            <ChevronDown aria-hidden="true" size={16} strokeWidth={1.5} className="transition-transform duration-200 group-open:rotate-180" />
            Tüm uçuşları gör
          </summary>
          <div className="mt-6">
            <FlightsView result={result} budgetRef={budgetRef} />
            <WebFlightSearch query={query} rates={rates} demo={aiDemoEnabled()} inBudget={webFlight} />
          </div>
        </details>
      </div>
      <FlightPrintSummary ticket={choice.status === "none" ? null : choice.ticket} />
    </>
  );
}

/** The calm summary: each airport's cheapest ticket with its link; "EN UCUZ" in accent on the overall cheapest. */
export function CheapestByAirport({ result, budgetRef }: { result: FlightsResult; budgetRef: string | null }) {
  if (result.status === "unavailable") {
    return (
      <div>
        <p className="text-body text-ink-muted">{FLIGHTS_ERROR_MESSAGES[result.reason]}</p>
        <FlightsLinks links={result.links} className="mt-4" />
      </div>
    );
  }
  const rows = result.groups.flatMap((g) => (g.tickets[0] ? [{ group: g, ticket: g.tickets[0] }] : []));
  return (
    <div className="grid gap-3">
      {result.fixture ? (
        <Caption as="p" tone="warn" className="rounded-sm border border-warn px-3 py-2">
          ÖRNEK VERİ · GELİŞTİRME FIXTURE&apos;I · GERÇEK FİYAT DEĞİL
        </Caption>
      ) : null}
      {rows.length === 0 ? <p className="text-body text-ink-muted">Bu tarihler ve ±3 gün için önbellekte fiyat yok.</p> : null}
      <ul className="grid divide-y divide-dashed divide-rule">
        {rows.map(({ group, ticket }) => {
          const cheapest = ticket.id === result.cheapestId;
          return (
            <li key={group.airport} className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <Caption as="p">
                  {group.airport} · {AIRPORT_NAMES[group.airport] ?? group.airport}
                  {ticket.differentDates ? " · FARKLI TARİH" : ""}
                </Caption>
                <p className="mt-1 text-body">
                  {airlineName(ticket.airline)} · <span className="font-mono tabular">{formatTicketDay(ticket.out.departDate)}</span>
                </p>
                <Caption as="p" className="mt-0.5">
                  {formatStops(ticket.out.stops)}
                  {ticket.back ? ` · DÖNÜŞ ${formatStops(ticket.back.stops)}` : ""}
                </Caption>
              </div>
              <div className="text-right">
                <p className={cheapest ? "font-mono text-heading tabular text-accent" : "font-mono text-heading tabular"}>{formatTRY(ticket.pricePerAdult)}</p>
                <Caption as="p" tone={cheapest ? "accent" : "muted"}>
                  {cheapest ? "EN UCUZ · 1 YETİŞKİN" : "1 YETİŞKİN"}
                </Caption>
                <div className="mt-1 flex flex-wrap justify-end gap-x-4 gap-y-1">
                  <a href={ticket.bookingUrl} target="_blank" rel="sponsored noopener noreferrer" className="inline-flex items-center gap-1 text-caption underline underline-offset-4">
                    Güncel fiyatı gör
                    <ArrowUpRight aria-hidden="true" size={14} strokeWidth={1.5} />
                  </a>
                  <AddToBudgetButton flightRef={ticket.ref} inBudget={ticket.ref === budgetRef} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <Caption as="p">{SOURCE_LINE}</Caption>
    </div>
  );
}

/** Printed instead of the cards: the budget's flight in one line. */
export function FlightPrintSummary({ ticket }: { ticket: FlightTicket | null }) {
  if (!ticket) return <p className="hidden text-body print:block">Uçuş seçilmedi; seçilen tarihler için önbellekte fiyat yok.</p>;
  const leg = (l: Leg) => `${formatTicketDay(l.departDate)} · ${l.from} ${l.departTime} → ${l.to} ${l.arriveTime ?? "--:--"}${l.arriveDayOffset ? ` (+${l.arriveDayOffset})` : ""} · ${formatStops(l.stops).toLocaleLowerCase("tr")}`;
  return (
    <div className="hidden print:block">
      <p className="text-body">
        {airlineName(ticket.airline)} · {ticket.airline} {ticket.flightNumber}
      </p>
      <p className="mt-1 font-mono text-caption tabular">Gidiş: {leg(ticket.out)}</p>
      {ticket.back ? <p className="font-mono text-caption tabular">Dönüş: {leg(ticket.back)}</p> : null}
      <p className="mt-1 font-mono text-caption tabular">
        {ticket.pax} yolcu × {formatTRY(ticket.pricePerAdult)} = {formatTRY(ticket.totalPrice)}
      </p>
      <Caption as="p" className="mt-1">
        {cacheCaption(ticket.foundOn)}
        {ticket.differentDates ? " · FARKLI TARİH" : ""}
      </Caption>
    </div>
  );
}

const SOURCE_LINE = "KAYNAK: TRAVELPAYOUTS (AVIASALES) · SON 48 SAATTEKİ ARAMALARA DAYALI ÖNBELLEK · TAHMİNİ";

function groupMessage(group: AirportGroup, direct: boolean): string | null {
  switch (group.outcome) {
    case "exact":
      return null;
    case "nearby":
      return direct
        ? "Bu tarihlerde aktarmasız uçuş bulunamadı. Aşağıda ±3 gün içindeki aktarmasız seçenekler, kendi tarihleriyle."
        : "Seçtiğin tarihler için önbellekte fiyat yok. Aşağıda ±3 gün içindeki en ucuz seçenekler, kendi tarihleriyle.";
    case "none":
      return direct ? "Bu tarihlerde aktarmasız uçuş bulunamadı." : "Bu tarihler ve ±3 gün için önbellekte fiyat yok.";
    case "error":
      return FLIGHTS_ERROR_MESSAGES[group.reason];
  }
}

/** Pure view of a search result, so tests can render every state without the network. */
export function FlightsView({ result, budgetRef = null }: { result: FlightsResult; budgetRef?: string | null }) {
  if (result.status === "unavailable") {
    return (
      <div className="rounded-md border border-dashed border-rule px-5 py-6 md:px-8">
        <p className="max-w-2xl text-body">{FLIGHTS_ERROR_MESSAGES[result.reason]}</p>
        <p className="mt-2 max-w-2xl text-body text-ink-muted">Güncel fiyatlara buradan bakabilirsin:</p>
        <FlightsLinks links={result.links} className="mt-4" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DirectChip selected={result.direct} />
        <Caption as="p">{SOURCE_LINE}</Caption>
      </div>
      {result.fixture ? (
        <Caption as="p" tone="warn" className="mt-4 rounded-sm border border-warn px-3 py-2">
          ÖRNEK VERİ · GELİŞTİRME FIXTURE&apos;I · GERÇEK FİYAT DEĞİL
        </Caption>
      ) : null}

      <div className="mt-8 grid gap-10">
        {result.groups.map((group) => {
          const message = groupMessage(group, result.direct);
          return (
            <section key={group.airport} aria-labelledby={`havalimani-${group.airport}`}>
              <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
                <h3 id={`havalimani-${group.airport}`} className="font-display text-heading">
                  {AIRPORT_NAMES[group.airport] ?? group.airport}
                </h3>
                <Caption>{group.airport}</Caption>
              </div>
              {message ? (
                <p className={group.outcome === "error" ? "mt-4 text-body text-warn" : "mt-4 text-body text-ink-muted"}>{message}</p>
              ) : null}
              {group.tickets.length ? (
                <div className="mt-4 grid gap-4">
                  {group.tickets.map((ticket, i) => {
                    const mark: CheapestMark =
                      ticket.id === result.cheapestId ? "overall" : i > 0 ? null : group.outcome === "nearby" ? "nearby" : "airport";
                    return <FlightTicketCard key={ticket.id} ticket={ticket} mark={mark} budgetRef={budgetRef} />;
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <FlightsLinks links={result.links} className="mt-8" />
    </div>
  );
}

export function FlightsSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-4">
      <SkeletonTicket label="Uçuşlar yükleniyor" />
      <SkeletonTicket label="Uçuşlar yükleniyor" />
    </div>
  );
}
