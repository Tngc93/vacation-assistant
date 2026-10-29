import { ArrowUpRight } from "lucide-react";
import { buttonClasses, Caption, Ticket } from "@/components/ui";
import { airlineName } from "@/data/airlines";
import type { Locale } from "@/i18n/locales";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/cn";
import { formatTRY } from "@/lib/format";
import { cacheCaption, formatDuration, formatStops, formatTicketDay } from "@/lib/flights/display";
import type { FlightTicket, Leg } from "@/lib/flights/tickets";
import { AddToBudgetButton } from "./AddToBudgetButton";

/** Overall cheapest on the chosen dates, cheapest at one airport, or cheapest of the ±3 day fallback. */
export type CheapestMark = "overall" | "airport" | "nearby" | null;

function LegRow({ label, leg, locale }: { label: string; leg: Leg; locale: Locale }) {
  const i18n = getI18n(locale);
  return (
    <div className="min-w-0">
      <Caption as="p">
        {label} · {formatTicketDay(leg.departDate, locale)}
      </Caption>
      <p className="mt-1.5 flex items-center gap-3 font-mono text-heading tabular">
        <span>
          {leg.from} <span className="text-ink-muted">{leg.departTime}</span>
        </span>
        <span aria-hidden="true" className="h-px min-w-6 flex-1 bg-rule" />
        <span>
          <span className="text-ink-muted">
            {leg.arriveTime ?? "--:--"}
            {leg.arriveDayOffset > 0 ? <sup className="ml-0.5 text-micro">+{leg.arriveDayOffset}</sup> : null}
          </span>{" "}
          {leg.to}
        </span>
      </p>
      <Caption as="p" className="mt-1">
        {formatStops(leg.stops, i18n)}
        {leg.durationMin ? ` · ${formatDuration(leg.durationMin, i18n)}` : ""}
      </Caption>
    </div>
  );
}

/** DESIGN.md "Flight tickets": codes, times, stops, airline and price in mono; the cheapest price in accent. */
export function FlightTicketCard({
  ticket,
  mark,
  budgetRef = null,
  locale = "tr",
}: {
  ticket: FlightTicket;
  mark: CheapestMark;
  budgetRef?: string | null;
  locale?: Locale;
}) {
  const i18n = getI18n(locale);
  const { m, f } = i18n;
  const price = (amount: number) => formatTRY(amount, locale);
  return (
    <Ticket
      stubBeside="md"
      aria-label={f(m.flights.ticketLabel, { from: ticket.originAirport, to: ticket.destinationAirport, price: price(ticket.pricePerAdult) })}
      stub={
        <div className="flex h-full flex-col gap-3">
          <div>
            <Caption as="p">{m.flights.adult}</Caption>
            <p className={cn("mt-1 font-mono text-title tabular", mark ? "text-accent" : "text-ink")}>
              {price(ticket.pricePerAdult)}
            </p>
            {mark ? (
              <Caption as="p" tone="accent" className="mt-0.5">
                {mark === "overall"
                  ? m.flights.cheapest
                  : mark === "nearby"
                    ? m.flights.cheapestNearby
                    : f(m.flights.cheapestAt, { airport: ticket.originAirport })}
              </Caption>
            ) : null}
          </div>
          <div>
            <Caption as="p">{f(m.flights.estimatedTotal, { count: ticket.pax })}</Caption>
            <p className="mt-1 font-mono text-body tabular">{price(ticket.totalPrice)}</p>
          </div>
          <Caption as="p">{cacheCaption(ticket.foundOn, i18n)}</Caption>
          <a
            href={ticket.bookingUrl}
            target="_blank"
            rel="sponsored noopener noreferrer"
            className={buttonClasses({ variant: mark ? "primary" : "secondary", className: "mt-auto w-full" })}
          >
            {m.flights.seePrice}
            <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.5} />
          </a>
          <AddToBudgetButton flightRef={ticket.ref} inBudget={ticket.ref === budgetRef} className="self-center" />
        </div>
      }
    >
      {ticket.differentDates ? (
        <Caption as="p" tone="warn" className="mb-4">
          {m.flights.notYourDates}
        </Caption>
      ) : null}
      <div className="grid gap-5">
        <LegRow label={m.flights.out} leg={ticket.out} locale={locale} />
        {ticket.back ? <LegRow label={m.flights.back} leg={ticket.back} locale={locale} /> : null}
      </div>
      <p className="mt-5 text-caption">
        {airlineName(ticket.airline, locale)} ·{" "}
        <span className="font-mono tabular">
          {ticket.airline} {ticket.flightNumber}
        </span>
      </p>
      {ticket.otherReturns.length ? <OtherReturns tickets={ticket.otherReturns} budgetRef={budgetRef} locale={locale} /> : null}
    </Ticket>
  );
}

/** The same outbound flight with other return flights, each with its own price and link. */
function OtherReturns({ tickets, budgetRef, locale }: { tickets: FlightTicket[]; budgetRef: string | null; locale: Locale }) {
  const i18n = getI18n(locale);
  const { m, f } = i18n;
  return (
    <details className="mt-5 border-t border-rule pt-4">
      <summary className="cursor-pointer select-none text-caption underline underline-offset-4">
        {f(m.flights.otherReturns, { count: tickets.length })}
      </summary>
      <ul className="mt-3 grid gap-3">
        {tickets.map((t) =>
          t.back ? (
            <li key={t.id} className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-dashed border-rule pb-3 last:border-b-0 last:pb-0">
              <div className="min-w-0">
                <Caption as="p">{f(m.flights.backOn, { date: formatTicketDay(t.back.departDate, locale) })}</Caption>
                <p className="mt-1 font-mono text-body tabular">
                  {t.back.from} <span className="text-ink-muted">{t.back.departTime}</span> → <span className="text-ink-muted">{t.back.arriveTime ?? "--:--"}</span>
                  {t.back.arriveDayOffset > 0 ? <sup className="ml-0.5 text-micro text-ink-muted">+{t.back.arriveDayOffset}</sup> : null} {t.back.to}
                </p>
                <Caption as="p" className="mt-0.5">
                  {formatStops(t.back.stops, i18n)}
                  {t.back.durationMin ? ` · ${formatDuration(t.back.durationMin, i18n)}` : ""}
                </Caption>
              </div>
              <div className="text-right">
                <p className="font-mono text-body tabular">{formatTRY(t.pricePerAdult, locale)}</p>
                <Caption as="p">{f(m.flights.adultTotal, { total: formatTRY(t.totalPrice, locale) })}</Caption>
                <a href={t.bookingUrl} target="_blank" rel="sponsored noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-caption underline underline-offset-4">
                  {m.flights.seePrice}
                  <ArrowUpRight aria-hidden="true" size={14} strokeWidth={1.5} />
                </a>
                <div>
                  <AddToBudgetButton flightRef={t.ref} inBudget={t.ref === budgetRef} className="mt-1" />
                </div>
              </div>
            </li>
          ) : null,
        )}
      </ul>
    </details>
  );
}
