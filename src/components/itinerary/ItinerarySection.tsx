import { Skeleton } from "@/components/ui";
import type { Destination } from "@/data/destinations";
import { airlineName } from "@/data/airlines";
import type { EditBatch } from "@/lib/ai/edits";
import { DAYTIME_CATEGORIES, EVENING_CATEGORIES, eveningCategoriesFor, type EveningCategory } from "@/lib/itinerary/config";
import type { ItineraryInput, PlanPlace } from "@/lib/itinerary/plan";
import type { CategoryId } from "@/lib/places/categories";
import { loadFlights } from "@/lib/flights/load";
import { chooseFlight } from "@/lib/flights/select";
import type { FlightTicket } from "@/lib/flights/tickets";
import { loadPlacesFile } from "@/lib/places/load";
import { addDays } from "@/lib/search/dates";
import type { SearchState } from "@/lib/search/params";
import { ItineraryView } from "./ItineraryView";

type Props = {
  search: SearchState;
  destination: Destination;
  categories: CategoryId[];
  direct: boolean;
  /** `?flight=`: the budget's ticket. */
  flight: string | null;
  skip: string[];
  /** `?ai=`: an AI plan's daytime stops per day. */
  aiPlan: string[][] | null;
  /** `?edit=`: chat edits. */
  edits: EditBatch[];
};

/** The budget's flight in destination local time (the API's legs are already local to each airport). */
export function flightMoments(ticket: FlightTicket | null): ItineraryInput["flight"] {
  if (!ticket) return null;
  return {
    arrive: ticket.out.arriveTime ? { date: addDays(ticket.out.departDate, ticket.out.arriveDayOffset), time: ticket.out.arriveTime } : null,
    leave: ticket.back ? { date: ticket.back.departDate, time: ticket.back.departTime } : null,
    label: `${airlineName(ticket.airline)} · ${ticket.airline} ${ticket.flightNumber}`,
  };
}

/** Day-by-day plan (PRD 20–22): built from the pre-fetched places, deterministically; AI and chat edits are optional. */
export async function ItinerarySection({ search, destination, categories, direct, flight, skip, aiPlan, edits }: Props) {
  const [file, flights] = await Promise.all([
    loadPlacesFile(destination.cityCode),
    loadFlights(search.from, search.to, search.depart, search.return, search.pax, direct),
  ]);
  const choice = chooseFlight(flights, flight);
  const ticket = choice.status === "none" ? null : choice.ticket;
  const take = (ids: readonly CategoryId[]): PlanPlace[] =>
    ids.flatMap((category) => {
      const entry = file?.categories[category];
      return entry?.status === "ok" ? entry.places.map((p) => ({ ...p, category })) : [];
    });

  if (!file) {
    return <p className="text-body text-ink-muted">Bu şehir için mekân verisi henüz hazır değil; plan kurulamıyor.</p>;
  }
  const input: Omit<ItineraryInput, "skip"> = {
    depart: search.depart,
    return: search.return,
    timeZone: destination.timeZone,
    flight: flightMoments(ticket),
    daytime: take(DAYTIME_CATEGORIES),
    evening: take(eveningCategoriesFor(categories)),
  };
  // Every evening category, so a chat edit ("akşamları kokteyl bar") can switch without a reload.
  const eveningPool = Object.fromEntries(EVENING_CATEGORIES.map((c) => [c, take([c])])) as Record<EveningCategory, PlanPlace[]>;
  return (
    <ItineraryView
      input={input}
      initialSkip={skip}
      eveningPool={eveningPool}
      initialEvening={eveningCategoriesFor(categories)}
      initialAi={aiPlan}
      initialEdits={edits}
      cityName={destination.nameTr}
      center={{ lat: destination.lat, lon: destination.lon }}
    />
  );
}

export function ItinerarySkeleton() {
  return (
    <div aria-busy="true" className="grid gap-6">
      <span className="sr-only">Plan hazırlanıyor</span>
      {[0, 1].map((i) => (
        <div key={i} className="grid gap-3">
          <Skeleton className="h-16 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ))}
    </div>
  );
}
