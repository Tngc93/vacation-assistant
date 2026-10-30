import { ArrowUpRight } from "lucide-react";
import { Caption, SkeletonTicket } from "@/components/ui";
import { airlineName } from "@/data/airlines";
import { findDestination } from "@/data/destinations";
import { aiDemoEnabled } from "@/lib/ai/demo";
import type { WebFlightChoice } from "@/lib/budget/params";
import { loadRateTable } from "@/lib/rates/table";
import type { I18n } from "@/i18n/i18n";
import type { Locale } from "@/i18n/locales";
import { getI18n } from "@/i18n/server";
import { cacheCaption, formatStops, formatTicketDay, shortAirportName } from "@/lib/flights/display";
import { withGoogleLanguage } from "@/lib/flights/links";
import { formatTRY } from "@/lib/format";
import { loadFlights } from "@/lib/flights/load";
import type { AirportGroup, FlightsResult } from "@/lib/flights/search";
import { choiceRef, chooseFlight } from "@/lib/flights/select";
import type { FlightTicket, Leg } from "@/lib/flights/tickets";
import { DirectChip } from "./DirectChip";
import { FlightsLinks } from "./FlightsLinks";
import { AddToBudgetButton } from "./AddToBudgetButton";
import { FlightTicketCard, type CheapestMark } from "./FlightTicketCard";
import { OriginControl, PeopleControl } from "@/components/plan/TripControls";
import { type OriginCode, toOriginOption } from "@/data/origins";
import { findOrigin, resolveOrigin } from "@/lib/origins/data";
import { FlightsPanel } from "./FlightsPanel";
import { WebFlightSearch } from "./WebFlightSearch";

type Props = {
  locale: Locale;
  from: OriginCode;
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

/**
 * "Uçuşlar": the origin and the number of people on top, then cached Travelpayouts prices for every origin
 * airport (server-side; the token never reaches the browser): each airport's cheapest ticket, and under "Tüm
 * uçuşları gör" the full list with its filter and the web search, at full width.
 */
export async function FlightsSection({ locale, from, to, depart, return: ret, pax, direct, flight, webFlight }: Props) {
  const destination = findDestination(to)!;
  const origin = resolveOrigin(from, locale);
  const [result, rates] = await Promise.all([loadFlights(from, to, depart, ret, pax, direct), loadRateTable(destination.currency)]);
  const choice = chooseFlight(result, flight);
  const query = {
    fromAirports: origin.airports.map((a) => a.code),
    toCity: destination.nameEn,
    toAirports: destination.airports,
    depart,
    return: ret,
    adults: pax,
  };
  const budgetRef = webFlight ? null : choiceRef(choice);
  return (
    <FlightsPanel
      controls={
        <>
          <OriginControl value={toOriginOption(origin)} />
          <PeopleControl value={pax} />
        </>
      }
      cheapest={
        <>
          <div className="print:hidden">
            <CheapestByAirport result={result} budgetRef={budgetRef} locale={locale} />
          </div>
          <FlightPrintSummary ticket={choice.status === "none" ? null : choice.ticket} locale={locale} />
        </>
      }
      all={
        <>
          <FlightsView result={result} budgetRef={budgetRef} locale={locale} />
          {result.status === "unavailable" && result.reason === "same-city" ? null : (
            <WebFlightSearch query={query} rates={rates} demo={aiDemoEnabled()} inBudget={webFlight} />
          )}
        </>
      }
    />
  );
}

/** The calm summary: each airport's cheapest ticket with its link; "EN UCUZ" in accent on the overall cheapest. */
export function CheapestByAirport({ result, budgetRef, locale = "tr" }: { result: FlightsResult; budgetRef: string | null; locale?: Locale }) {
  const i18n = getI18n(locale);
  const { m, f } = i18n;
  if (result.status === "unavailable") {
    return (
      <div>
        <p className="text-body text-ink-muted">{m.flights.errors[result.reason]}</p>
        {result.reason === "same-city" ? null : <FlightsLinks links={result.links} className="mt-4" />}
      </div>
    );
  }
  const rows = result.groups.flatMap((g) => (g.tickets[0] ? [{ group: g, ticket: g.tickets[0] }] : []));
  return (
    <div className="grid gap-3">
      {result.fixture ? (
        <Caption as="p" tone="warn" className="rounded-sm border border-warn px-3 py-2">
          {m.flights.sample}
        </Caption>
      ) : null}
      {rows.length === 0 ? <NoCachedFlights links={result.links} locale={locale} /> : null}
      <ul aria-label={m.flights.cheapestPerAirport} className="grid gap-4 md:grid-cols-2">
        {rows.map(({ group, ticket }) => {
          const cheapest = ticket.id === result.cheapestId;
          return (
            <li
              key={group.airport}
              className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 rounded-md border border-rule bg-paper-raised px-5 py-5 md:px-6"
            >
              <div className="min-w-0">
                <Caption as="p">
                  {group.airport} · {airportName(group, i18n)}
                  {ticket.differentDates ? m.flights.differentDate : ""}
                </Caption>
                <p className="mt-1 text-body">
                  {airlineName(ticket.airline, locale)} · <span className="font-mono tabular">{formatTicketDay(ticket.out.departDate, locale)}</span>
                </p>
                <Caption as="p" className="mt-0.5">
                  {formatStops(ticket.out.stops, i18n)}
                  {ticket.back ? f(m.flights.returnStops, { stops: formatStops(ticket.back.stops, i18n) }) : ""}
                </Caption>
              </div>
              <div className="text-right">
                <p className={cheapest ? "font-mono text-heading tabular text-accent" : "font-mono text-heading tabular"}>
                  {formatTRY(ticket.pricePerAdult, locale)}
                </p>
                <Caption as="p" tone={cheapest ? "accent" : "muted"}>
                  {cheapest ? m.flights.cheapestAdult : m.flights.adult}
                </Caption>
                <div className="mt-1 flex flex-wrap justify-end gap-x-4 gap-y-1">
                  <a href={ticket.bookingUrl} target="_blank" rel="sponsored noopener noreferrer" className="inline-flex items-center gap-1 text-caption underline underline-offset-4">
                    {m.flights.seePrice}
                    <ArrowUpRight aria-hidden="true" size={14} strokeWidth={1.5} />
                  </a>
                  <AddToBudgetButton flightRef={ticket.ref} inBudget={ticket.ref === budgetRef} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <Caption as="p">{m.flights.source}</Caption>
    </div>
  );
}

/**
 * The airport's short name when we have one ("Sabiha Gökçen"), else its name in the interface language from the
 * origins data (the search result names it in Turkish).
 */
const airportName = (group: AirportGroup, i18n: Pick<I18n, "locale" | "m">) =>
  shortAirportName(group.airport, i18n) ??
  (i18n.locale === "tr" ? group.name : (findOrigin(group.airport, i18n.locale)?.airports.find((a) => a.code === group.airport)?.name ?? group.name));

/**
 * Nothing cached for any airport on these dates or ±3 days: an honest empty state, and the same search on
 * Aviasales and Google Flights, filled in with this origin.
 */
function NoCachedFlights({ links, locale }: { links: FlightsResult["links"]; locale: Locale }) {
  const { m } = getI18n(locale);
  return (
    <div className="rounded-md border border-dashed border-rule px-5 py-5 md:px-6">
      <p className="text-body">{m.flights.noCache}</p>
      <p className="mt-1 text-body text-ink-muted">{m.flights.noCacheWhy}</p>
      <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-body">
        <a href={links.aviasales} target="_blank" rel="sponsored noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
          {m.flights.seePrice}
          <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.5} />
        </a>
        <a href={withGoogleLanguage(links.googleFlights, locale)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
          {m.flights.openGoogleFlights}
          <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.5} />
        </a>
      </p>
    </div>
  );
}

/** Printed instead of the cards: the budget's flight in one line. */
export function FlightPrintSummary({ ticket, locale = "tr" }: { ticket: FlightTicket | null; locale?: Locale }) {
  const i18n = getI18n(locale);
  const { intl, m, f } = i18n;
  if (!ticket) return <p className="hidden text-body print:block">{m.flights.printNone}</p>;
  const leg = (l: Leg) =>
    `${formatTicketDay(l.departDate, locale)} · ${l.from} ${l.departTime} → ${l.to} ${l.arriveTime ?? "--:--"}${l.arriveDayOffset ? ` (+${l.arriveDayOffset})` : ""} · ${formatStops(l.stops, i18n).toLocaleLowerCase(intl)}`;
  return (
    <div className="hidden print:block">
      <p className="text-body">
        {airlineName(ticket.airline, locale)} · {ticket.airline} {ticket.flightNumber}
      </p>
      <p className="mt-1 font-mono text-caption tabular">{f(m.flights.printOut, { leg: leg(ticket.out) })}</p>
      {ticket.back ? <p className="font-mono text-caption tabular">{f(m.flights.printBack, { leg: leg(ticket.back) })}</p> : null}
      <p className="mt-1 font-mono text-caption tabular">
        {f(m.flights.printTotal, { pax: ticket.pax, price: formatTRY(ticket.pricePerAdult, locale), total: formatTRY(ticket.totalPrice, locale) })}
      </p>
      <Caption as="p" className="mt-1">
        {cacheCaption(ticket.foundOn, i18n)}
        {ticket.differentDates ? m.flights.differentDate : ""}
      </Caption>
    </div>
  );
}

function groupMessage(group: AirportGroup, direct: boolean, { m }: Pick<I18n, "m">): string | null {
  switch (group.outcome) {
    case "exact":
      return null;
    case "nearby":
      return direct ? m.flights.nearbyDirect : m.flights.nearby;
    case "none":
      return direct ? m.flights.noneDirect : m.flights.none;
    case "error":
      return m.flights.errors[group.reason];
  }
}

/** Pure view of a search result, so tests can render every state without the network. */
export function FlightsView({ result, budgetRef = null, locale = "tr" }: { result: FlightsResult; budgetRef?: string | null; locale?: Locale }) {
  const i18n = getI18n(locale);
  const { m } = i18n;
  if (result.status === "unavailable") {
    return (
      <div className="rounded-md border border-dashed border-rule px-5 py-6 md:px-8">
        <p className="max-w-2xl text-body">{m.flights.errors[result.reason]}</p>
        {result.reason === "same-city" ? null : (
          <>
            <p className="mt-2 max-w-2xl text-body text-ink-muted">{m.flights.lookHere}</p>
            <FlightsLinks links={result.links} className="mt-4" />
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DirectChip selected={result.direct} />
        <Caption as="p">{m.flights.source}</Caption>
      </div>
      {result.fixture ? (
        <Caption as="p" tone="warn" className="mt-4 rounded-sm border border-warn px-3 py-2">
          {m.flights.sample}
        </Caption>
      ) : null}

      <div className="mt-8 grid gap-10">
        {result.groups.map((group) => {
          const message = groupMessage(group, result.direct, i18n);
          return (
            <section key={group.airport} aria-labelledby={`havalimani-${group.airport}`}>
              <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
                <h3 id={`havalimani-${group.airport}`} className="font-display text-heading">
                  {airportName(group, i18n)}
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
                    return <FlightTicketCard key={ticket.id} ticket={ticket} mark={mark} budgetRef={budgetRef} locale={locale} />;
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

export function FlightsSkeleton({ locale }: { locale: Locale }) {
  const { m } = getI18n(locale);
  return (
    <div aria-busy="true" className="grid gap-4">
      <SkeletonTicket label={m.flights.loading} />
      <SkeletonTicket label={m.flights.loading} />
    </div>
  );
}
