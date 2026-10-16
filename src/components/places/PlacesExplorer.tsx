"use client";

import { Map as MapIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Button, Caption, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CATEGORIES, type CategoryId } from "@/lib/places/categories";
import { serializeCategories, toggleCategory } from "@/lib/places/cats";
import type { RankedPlace } from "@/lib/places/rank";
import { CategoryChips } from "./CategoryChips";
import { PlaceCard } from "./PlaceCard";

// MapLibre is large and browser-only: load it on demand, never on the server.
const PlacesMap = dynamic(() => import("./PlacesMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-80 w-full rounded-md md:h-[32rem]" />,
});

export type CategoryResult =
  | { category: CategoryId; status: "ok"; places: RankedPlace[]; wikipediaCountsAvailable: boolean }
  | { category: CategoryId; status: "error" };

export type PlacesExplorerProps = {
  center: { lat: number; lon: number };
  categories: readonly CategoryId[];
  results: readonly CategoryResult[];
};

function subscribeWide(callback: () => void) {
  const query = window.matchMedia("(min-width: 48rem)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function osmUrl(center: { lat: number; lon: number }) {
  return `https://www.openstreetmap.org/#map=15/${center.lat.toFixed(4)}/${center.lon.toFixed(4)}`;
}

/** Category chips, the place list and the map, kept in sync. Categories live in the URL (?cats=). */
export function PlacesExplorer({ center, categories, results }: PlacesExplorerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isWide = useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia("(min-width: 48rem)").matches,
    () => false,
  );
  // On phones the map is opt-in (it is a large download); on wider screens it shows by default.
  const [mapOnPhone, setMapOnPhone] = useState(false);
  const showMap = isWide || mapOnPhone;
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const mapRef = useRef<HTMLDivElement>(null);

  const places = useMemo(() => results.flatMap((r) => (r.status === "ok" ? r.places : [])), [results]);

  const onToggle = (id: CategoryId) => {
    const params = new URLSearchParams(window.location.search);
    params.set("cats", serializeCategories(toggleCategory(categories, id)));
    startTransition(() => router.replace(`/plan?${params.toString()}`, { scroll: false }));
  };

  // A dot clicked on the map brings its card forward.
  const onSelectFromMap = useCallback((id: string) => {
    setSelectedId(id);
    const card = cardRefs.current.get(id);
    card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    card?.focus({ preventScroll: true });
  }, []);

  // "Haritada göster" brings the map into view and marks the place.
  const onShowOnMap = (id: string) => {
    setSelectedId(id);
    setMapOnPhone(true);
    requestAnimationFrame(() => mapRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  return (
    <div>
      <CategoryChips selected={categories} onToggle={onToggle} />

      <div className="mt-8 grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
        <div className={cn("min-w-0 transition-opacity duration-200", pending && "opacity-60")} aria-busy={pending}>
          {categories.length === 0 ? (
            <EmptyState text="Görmek istediğin mekân türlerini yukarıdan seç." />
          ) : (
            results.map((result) => (
              <section key={result.category} aria-labelledby={`kategori-${result.category}`} className="mb-10 last:mb-0">
                <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-rule pb-2">
                  <h3 id={`kategori-${result.category}`} className="font-display text-heading">
                    {CATEGORIES[result.category].label}
                  </h3>
                  {result.status === "ok" && result.places.length > 0 ? (
                    <Caption>{result.places.length} kayıt</Caption>
                  ) : null}
                </div>
                {result.status === "error" ? (
                  <EmptyState
                    text="Bu kategorinin verisi şu an alınamadı."
                    action={
                      <Button variant="secondary" onClick={() => startTransition(() => router.refresh())}>
                        Yeniden dene
                      </Button>
                    }
                  />
                ) : result.places.length === 0 ? (
                  <EmptyState
                    text="Bu kategoride kayıt bulamadık."
                    action={
                      <a href={osmUrl(center)} target="_blank" rel="noopener noreferrer" className="text-caption text-sea underline">
                        Bölgeye OpenStreetMap&apos;te bak
                      </a>
                    }
                  />
                ) : (
                  <>
                    {CATEGORIES[result.category].ranking === "wikipedia" && !result.wikipediaCountsAvailable ? (
                      <Caption as="p" className="mb-3">
                        Vikipedi dil sayıları şu an alınamadı; sıra ada göre
                      </Caption>
                    ) : null}
                    <div className="grid gap-3">
                      {result.places.map((place) => (
                        <PlaceCard
                          key={place.id}
                          ref={(el) => {
                            if (el) cardRefs.current.set(place.id, el);
                            else cardRefs.current.delete(place.id);
                          }}
                          place={place}
                          active={activeId === place.id || selectedId === place.id}
                          onActivate={setActiveId}
                          onShowOnMap={onShowOnMap}
                        />
                      ))}
                    </div>
                  </>
                )}
              </section>
            ))
          )}
          <p className="mt-8 text-caption text-ink-muted">
            Mekân verisi:{" "}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">
              © OpenStreetMap katkıcıları
            </a>{" "}
            (ODbL). Görülecek yerler ve müzeler Vikipedi&apos;deki dil sayısına (Wikidata), yeme-içme mekânları OSM
            kaydının ayrıntısına göre sıralanır; puan verisi yoktur.
          </p>
        </div>

        <div ref={mapRef} className="min-w-0 scroll-mt-24 md:sticky md:top-6">
          {showMap ? (
            <PlacesMap
              places={places}
              center={center}
              activeId={activeId}
              selectedId={selectedId}
              onActivate={setActiveId}
              onSelect={onSelectFromMap}
            />
          ) : (
            <Button variant="secondary" className="w-full" onClick={() => setMapOnPhone(true)}>
              <MapIcon aria-hidden="true" size={16} strokeWidth={1.5} />
              Haritayı göster
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-rule px-5 py-6">
      <p className="text-body text-ink-muted">{text}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
