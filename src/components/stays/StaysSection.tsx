import { PeopleControl } from "@/components/plan/TripControls";
import { Skeleton } from "@/components/ui";
import type { Destination } from "@/data/destinations";
import type { Locale } from "@/i18n/locales";
import { getI18n } from "@/i18n/server";
import { aiDemoEnabled } from "@/lib/ai/demo";
import { loadRateTable } from "@/lib/rates/table";
import type { SearchState } from "@/lib/search/params";
import { StayCard } from "./StayCard";
import { StaysPanel } from "./StaysPanel";
import { WebStaySearch } from "./WebStaySearch";

/** "Konaklama" (PRD 9–10): the number of people, prefilled Booking and Google Hotels searches, the web search by neighbourhood. */
export async function StaysSection({ locale, search, destination }: { locale: Locale; search: SearchState; destination: Destination }) {
  const rates = await loadRateTable(destination.currency);
  return (
    <StaysPanel
      demo={aiDemoEnabled()}
      controls={<PeopleControl value={search.pax} />}
      links={<StayCard locale={locale} destination={destination} checkIn={search.depart} checkOut={search.return} adults={search.pax} />}
      web={
        <WebStaySearch
          query={{ city: destination.nameEn, country: destination.countryCode, checkIn: search.depart, checkOut: search.return, adults: search.pax }}
          rates={rates}
          demo={aiDemoEnabled()}
        />
      }
    />
  );
}

export function StaysSkeleton({ locale }: { locale: Locale }) {
  return (
    <div aria-busy="true" className="grid gap-4">
      <span className="sr-only">{getI18n(locale).m.stays.loading}</span>
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-40 w-full rounded-md" />
    </div>
  );
}
