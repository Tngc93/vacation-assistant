import { Caption, SkeletonTicket } from "@/components/ui";
import type { Destination } from "@/data/destinations";
import type { Origin } from "@/data/origins";
import { AIRPORT_NAMES } from "@/lib/flights/display";
import { FLIGHTS_ERROR_MESSAGES } from "@/lib/flights/errors";
import { searchFlights, type AirportGroup, type FlightsResult } from "@/lib/flights/search";
import { todayInIstanbul } from "@/lib/search/dates";
import { DirectChip } from "./DirectChip";
import { FlightsLinks } from "./FlightsLinks";
import { FlightTicketCard, type CheapestMark } from "./FlightTicketCard";

type Props = { origin: Origin; destination: Destination; depart: string; return: string; pax: number; direct: boolean };

/** Cached Travelpayouts prices for every origin airport (server-side; the token never reaches the browser). */
export async function FlightsSection(props: Props) {
  const result = await searchFlights({ ...props, today: todayInIstanbul(new Date()) });
  return <FlightsView result={result} />;
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
export function FlightsView({ result }: { result: FlightsResult }) {
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
                    return <FlightTicketCard key={ticket.id} ticket={ticket} mark={mark} />;
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
