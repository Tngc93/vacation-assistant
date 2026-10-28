import Link from "next/link";
import { Suspense } from "react";
import { CityPhoto } from "@/components/city/CityPhoto";
import { LocalTime } from "@/components/city/LocalTime";
import { HeroExplorer, type CategoryResult } from "@/components/places/HeroExplorer";
import { RateLine, RateLineFallback } from "@/components/plan/RateLine";
import { Caption, Skeleton } from "@/components/ui";
import { cityCentre, type Destination } from "@/data/destinations";
import { formatDay } from "@/lib/format";
import type { CategoryId } from "@/lib/places/categories";
import { loadPlacesFile } from "@/lib/places/load";
import { loadEventsFile } from "@/lib/events/load";
import { eventsInTrip, mastheadLine } from "@/lib/events/trip";
import { daysBetween, isoToDate } from "@/lib/search/dates";
import { editHref, type SearchState } from "@/lib/search/params";

type Props = { search: SearchState; destination: Destination; categories: CategoryId[]; showEvents: boolean };

/** The plan's first screen (DESIGN.md "Plan hero"): city, info line, chips and places carousel, photo and map. */
export async function PlanHero({ search, destination, categories, showEvents }: Props) {
  const [file, eventsFile] = await Promise.all([loadPlacesFile(destination.cityCode), loadEventsFile(destination.cityCode)]);
  const events = eventsInTrip(eventsFile?.events ?? [], search.depart, search.return);
  const inTown = mastheadLine(events);
  const results: CategoryResult[] = categories.map((category) => {
    const entry = file?.categories[category];
    return entry?.status === "ok"
      ? { category, status: "ok", places: entry.places, wikipediaCountsAvailable: entry.wikipediaCountsAvailable }
      : { category, status: "missing" };
  });
  const nights = daysBetween(search.depart, search.return);
  const day = (iso: string) => formatDay(isoToDate(iso)).toLocaleUpperCase("tr");

  const title = (
    <div>
      <Caption as="p">Plan · {destination.countryTr}</Caption>
      <h1 className="mt-2 break-words font-display text-headline">{destination.nameTr}</h1>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-micro uppercase tracking-[0.08em] text-ink-muted">
        <span className="tabular">
          {day(search.depart)} → {day(search.return)} · {nights} GECE
        </span>
        <span aria-hidden="true">·</span>
        <LocalTime timeZone={destination.timeZone} />
        <Suspense fallback={<RateLineFallback className="inline-block" />}>
          <RateLine currency={destination.currency} className="inline-flex" />
        </Suspense>
        <Link href={editHref(search)} className="text-ink underline underline-offset-4">
          Düzenle
        </Link>
      </div>
      {inTown ? <p className="mt-2 font-mono text-micro uppercase tracking-[0.08em] text-ink">{inTown}</p> : null}
    </div>
  );

  return (
    <HeroExplorer
      title={title}
      photo={file?.photo ? <CityPhoto photo={file.photo} cityName={destination.nameTr} /> : null}
      center={cityCentre(destination)}
      timeZone={destination.timeZone}
      categories={categories}
      results={results}
      fetchedAt={file?.fetchedAt ?? null}
      events={events}
      showEvents={showEvents}
    />
  );
}

export function PlanHeroSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-5 pb-8 pt-6 md:h-[calc(100svh-4rem-1px)] md:max-h-[60rem] md:grid-cols-12 md:gap-8">
      <span className="sr-only">Plan yükleniyor</span>
      <div className="grid content-start gap-4 md:col-span-7">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-12 w-full max-w-64" />
        <Skeleton className="h-3 w-full max-w-80" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-md" />
          ))}
        </div>
      </div>
      <div className="grid content-start gap-4 md:col-span-5">
        <Skeleton className="aspect-[16/7] w-full rounded-md" />
        <Skeleton className="hidden h-80 w-full rounded-md md:block" />
      </div>
    </div>
  );
}
