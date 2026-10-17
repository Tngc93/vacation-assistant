import { Skeleton } from "@/components/ui";
import type { Destination } from "@/data/destinations";
import type { CategoryId } from "@/lib/places/categories";
import { loadPlacesFile } from "@/lib/places/load";
import { PlacesExplorer, type CategoryResult } from "./PlacesExplorer";

/** Places for the selected categories, read from the pre-fetched city file (no live queries). */
export async function CityGuide({ destination, categories }: { destination: Destination; categories: CategoryId[] }) {
  const file = await loadPlacesFile(destination.cityCode);
  const results: CategoryResult[] = categories.map((category) => {
    const entry = file?.categories[category];
    return entry?.status === "ok"
      ? { category, status: "ok", places: entry.places, wikipediaCountsAvailable: entry.wikipediaCountsAvailable }
      : { category, status: "missing" };
  });
  return (
    <PlacesExplorer
      center={{ lat: destination.lat, lon: destination.lon }}
      timeZone={destination.timeZone}
      categories={categories}
      results={results}
      fetchedAt={file?.fetchedAt ?? null}
    />
  );
}

export function CityGuideSkeleton() {
  return (
    <div aria-busy="true" aria-label="Şehir rehberi yükleniyor">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-28" />
        ))}
      </div>
      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <div className="grid gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-md" />
          ))}
        </div>
        <Skeleton className="hidden h-[32rem] w-full rounded-md md:block" />
      </div>
    </div>
  );
}
