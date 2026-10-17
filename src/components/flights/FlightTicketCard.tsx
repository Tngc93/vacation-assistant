import { ArrowUpRight } from "lucide-react";
import { buttonClasses, Caption, Ticket } from "@/components/ui";
import { airlineName } from "@/data/airlines";
import { cn } from "@/lib/cn";
import { formatTRY } from "@/lib/format";
import { cacheCaption, formatDuration, formatStops, formatTicketDay } from "@/lib/flights/display";
import type { FlightTicket, Leg } from "@/lib/flights/tickets";

/** Overall cheapest on the chosen dates, cheapest at one airport, or cheapest of the ±3 day fallback. */
export type CheapestMark = "overall" | "airport" | "nearby" | null;

function LegRow({ label, leg }: { label: string; leg: Leg }) {
  return (
    <div className="min-w-0">
      <Caption as="p">
        {label} · {formatTicketDay(leg.departDate)}
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
        {formatStops(leg.stops)}
        {leg.durationMin ? ` · ${formatDuration(leg.durationMin)}` : ""}
      </Caption>
    </div>
  );
}

/** DESIGN.md "Flight tickets": codes, times, stops, airline and price in mono; the cheapest price in accent. */
export function FlightTicketCard({ ticket, mark }: { ticket: FlightTicket; mark: CheapestMark }) {
  return (
    <Ticket
      stubBeside="md"
      aria-label={`${ticket.originAirport} → ${ticket.destinationAirport}, ${formatTRY(ticket.pricePerAdult)} kişi başı`}
      stub={
        <div className="flex h-full flex-col gap-3">
          <div>
            <Caption as="p">1 YETİŞKİN</Caption>
            <p className={cn("mt-1 font-mono text-title tabular", mark ? "text-accent" : "text-ink")}>
              {formatTRY(ticket.pricePerAdult)}
            </p>
            {mark ? (
              <Caption as="p" tone="accent" className="mt-0.5">
                {mark === "overall" ? "EN UCUZ" : mark === "nearby" ? "±3 GÜNDE EN UCUZ" : `${ticket.originAirport} İÇİN EN UCUZ`}
              </Caption>
            ) : null}
          </div>
          <div>
            <Caption as="p">TAHMİNİ TOPLAM · {ticket.pax} YOLCU</Caption>
            <p className="mt-1 font-mono text-body tabular">{formatTRY(ticket.totalPrice)}</p>
          </div>
          <Caption as="p">{cacheCaption(ticket.foundOn)}</Caption>
          <a
            href={ticket.bookingUrl}
            target="_blank"
            rel="sponsored noopener noreferrer"
            className={buttonClasses({ variant: mark ? "primary" : "secondary", className: "mt-auto w-full" })}
          >
            Güncel fiyatı gör
            <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.5} />
          </a>
        </div>
      }
    >
      {ticket.differentDates ? (
        <Caption as="p" tone="warn" className="mb-4">
          FARKLI TARİH · seçtiğin tarihler değil
        </Caption>
      ) : null}
      <div className="grid gap-5">
        <LegRow label="GİDİŞ" leg={ticket.out} />
        {ticket.back ? <LegRow label="DÖNÜŞ" leg={ticket.back} /> : null}
      </div>
      <p className="mt-5 text-caption">
        {airlineName(ticket.airline)} ·{" "}
        <span className="font-mono tabular">
          {ticket.airline} {ticket.flightNumber}
        </span>
      </p>
      {ticket.otherReturns.length ? <OtherReturns tickets={ticket.otherReturns} /> : null}
    </Ticket>
  );
}

/** The same outbound flight with other return flights, each with its own price and link. */
function OtherReturns({ tickets }: { tickets: FlightTicket[] }) {
  return (
    <details className="mt-5 border-t border-rule pt-4">
      <summary className="cursor-pointer select-none text-caption underline underline-offset-4">
        Diğer dönüş saatleri ({tickets.length})
      </summary>
      <ul className="mt-3 grid gap-3">
        {tickets.map((t) =>
          t.back ? (
            <li key={t.id} className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-dashed border-rule pb-3 last:border-b-0 last:pb-0">
              <div className="min-w-0">
                <Caption as="p">DÖNÜŞ · {formatTicketDay(t.back.departDate)}</Caption>
                <p className="mt-1 font-mono text-body tabular">
                  {t.back.from} <span className="text-ink-muted">{t.back.departTime}</span> → <span className="text-ink-muted">{t.back.arriveTime ?? "--:--"}</span>
                  {t.back.arriveDayOffset > 0 ? <sup className="ml-0.5 text-micro text-ink-muted">+{t.back.arriveDayOffset}</sup> : null} {t.back.to}
                </p>
                <Caption as="p" className="mt-0.5">
                  {formatStops(t.back.stops)}
                  {t.back.durationMin ? ` · ${formatDuration(t.back.durationMin)}` : ""}
                </Caption>
              </div>
              <div className="text-right">
                <p className="font-mono text-body tabular">{formatTRY(t.pricePerAdult)}</p>
                <Caption as="p">
                  1 YETİŞKİN · TOPLAM {formatTRY(t.totalPrice)}
                </Caption>
                <a href={t.bookingUrl} target="_blank" rel="sponsored noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-caption underline underline-offset-4">
                  Güncel fiyatı gör
                  <ArrowUpRight aria-hidden="true" size={14} strokeWidth={1.5} />
                </a>
              </div>
            </li>
          ) : null,
        )}
      </ul>
    </details>
  );
}
