import { Skeleton } from "@/components/ui";
import type { Destination } from "@/data/destinations";
import { getCategoryPlaces } from "@/lib/places/cache";
import type { CategoryId } from "@/lib/places/categories";
import { PlacesExplorer, type CategoryResult } from "./PlacesExplorer";

async function loadResult(cityCode: string, category: CategoryId): Promise<CategoryResult> {
  try {
    const result = await getCategoryPlaces(cityCode, category);
    return {
      category,
      status: "ok",
      places: result.places,
      wikipediaCountsAvailable: result.wikipediaCountsAvailable,
    };
  } catch {
    // Every Overpass endpoint failed; this category shows a retry, the others still render.
    return { category, status: "error" };
  }
}

/**
 * Places for the selected categories from the shared cache. Uncached
 * categories are fetched one after another, not in parallel: Overpass allows
 * only a couple of concurrent queries per IP and answers 429 beyond that.
 */
export async function CityGuide({ destination, categories }: { destination: Destination; categories: CategoryId[] }) {
  const results: CategoryResult[] = [];
  for (const category of categories) results.push(await loadResult(destination.cityCode, category));
  return (
    <PlacesExplorer center={{ lat: destination.lat, lon: destination.lon }} categories={categories} results={results} />
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
