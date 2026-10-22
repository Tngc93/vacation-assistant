"use client";

import { Maximize2, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { useNearViewport } from "@/lib/useNearViewport";
import { Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CATEGORIES, type CategoryId } from "@/lib/places/categories";
import { serializeCategories, toggleCategory } from "@/lib/places/cats";
import type { StoredPlace } from "@/lib/places/file";
import type { ShownPlace } from "@/lib/places/rules";
import { CategoryChips } from "./CategoryChips";
import { MapFacade, useFirstInteraction } from "./MapFacade";
import { PlaceCard } from "./PlaceCard";
import { PlacesCarousel, type CarouselItem } from "./PlacesCarousel";

// MapLibre is large and browser-only: load it on demand, never on the server.
const PlacesMap = dynamic(() => import("./PlacesMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-md" />,
});

export type CategoryResult =
  | { category: CategoryId; status: "ok"; places: (StoredPlace & Pick<ShownPlace, "remote">)[]; wikipediaCountsAvailable: boolean }
  | { category: CategoryId; status: "missing" };

export type HeroExplorerProps = {
  /** City name and the mono info line (server-rendered). */
  title: ReactNode;
  /** The city photo strip, or null without one. */
  photo: ReactNode;
  center: { lat: number; lon: number };
  /** The city's IANA time zone, for today's hours. */
  timeZone: string;
  categories: readonly CategoryId[];
  results: readonly CategoryResult[];
  /** When the city file was fetched; null when there is no file for this city yet. */
  fetchedAt: string | null;
};

// A fixed zone, so the server render, the browser and every test agree on the day.
const fetchedDate = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Istanbul" });

const WIDE = "(min-width: 48rem)";
function subscribeWide(callback: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function osmUrl(center: { lat: number; lon: number }) {
  return `https://www.openstreetmap.org/#map=15/${center.lat.toFixed(4)}/${center.lon.toFixed(4)}`;
}

/**
 * The plan's first screen: the city, the category chips, the places carousel, the photo and the map, all in one
 * viewport on wide screens. Chips filter the carousel and the map together (?cats= in the URL); a card and its
 * dot light up together, a dot picked on the map brings its card into view.
 */
export function HeroExplorer({ title, photo, center, timeZone, categories, results, fetchedAt }: HeroExplorerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ id: string; n: number } | null>(null);
  const [fullScreen, setFullScreen] = useState(false);
  const isWide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => false);
  const [mapBox, mapNear] = useNearViewport<HTMLDivElement>();
  const interacted = useFirstInteraction();
  // The real map after the first interaction (on phones also once its strip is near), or at once full screen.
  const liveMap = fullScreen || (interacted && (isWide || mapNear));
  const closeButton = useRef<HTMLButtonElement>(null);

  const items = useMemo<CarouselItem[]>(
    () => results.flatMap((r) => (r.status === "ok" ? r.places.map((place, i) => ({ place, category: r.category, rank: i + 1 })) : [])),
    [results],
  );
  const places = useMemo(() => items.map((i) => i.place), [items]);
  const selected = items.find((i) => i.place.id === selectedId) ?? null;
  const missing = results.filter((r) => r.status === "missing").map((r) => CATEGORIES[r.category].label);
  const noRanking = results.some((r) => r.status === "ok" && CATEGORIES[r.category].ranking === "wikipedia" && !r.wikipediaCountsAvailable);

  const onToggle = (id: CategoryId) => {
    const params = new URLSearchParams(window.location.search);
    params.set("cats", serializeCategories(toggleCategory(categories, id)));
    startTransition(() => router.replace(`/plan?${params.toString()}`, { scroll: false }));
  };

  const onSelectFromMap = (id: string) => {
    setSelectedId(id);
    setReveal((r) => ({ id, n: (r?.n ?? 0) + 1 }));
  };

  // Full-screen map on phones: Escape closes it, focus goes to the close button, the page does not scroll behind.
  useEffect(() => {
    if (!fullScreen) return;
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullScreen(false);
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [fullScreen]);

  const detail = selected ? (
    <PlaceCard
      place={selected.place}
      category={selected.category}
      timeZone={timeZone}
      active
      onActivate={setActiveId}
      onClose={() => setSelectedId(null)}
      className="shadow-ticket"
    />
  ) : null;

  const empty =
    !fetchedAt ? (
      <EmptyState text="Bu şehir için mekân verisi henüz hazır değil." action={<OsmLink center={center} />} />
    ) : categories.length === 0 ? (
      <EmptyState text="Görmek istediğin mekân türlerini yukarıdan seç." />
    ) : items.length === 0 ? (
      <EmptyState
        text={missing.length ? `${missing.join(", ")} verisi henüz hazır değil.` : "Bu kategorilerde kayıt bulamadık."}
        action={<OsmLink center={center} />}
      />
    ) : null;

  return (
    <section
      id="yerler"
      aria-label="Yerler"
      className={cn(
        "grid scroll-mt-16 grid-cols-1 gap-5 pb-8 pt-6 print:hidden",
        // Wide screens: everything in one viewport under the site header (4rem + its 1px rule).
        "md:h-[calc(100svh-4rem-1px)] md:max-h-[60rem] md:min-h-[34rem] md:grid-cols-12 md:grid-rows-[auto_auto_minmax(0,1fr)] md:gap-x-8 md:gap-y-4",
      )}
    >
      <div className="min-w-0 md:col-span-7">{title}</div>

      {photo ? <div className="min-w-0 md:col-span-5 md:col-start-8 md:row-span-2 md:row-start-1">{photo}</div> : null}

      {fetchedAt ? (
        <div className="min-w-0 md:col-span-7 md:col-start-1 md:row-start-2">
          <CategoryChips selected={categories} onToggle={onToggle} />
        </div>
      ) : null}

      <div className={cn("flex min-h-0 min-w-0 flex-col transition-opacity duration-200 md:col-span-7 md:col-start-1 md:row-start-3", pending && "opacity-60")} aria-busy={pending}>
        {empty ?? (
          <PlacesCarousel
            key={categories.join(",")}
            items={items}
            center={center}
            timeZone={timeZone}
            activeId={activeId}
            selectedId={selectedId}
            onActivate={setActiveId}
            onSelect={setSelectedId}
            reveal={reveal}
          />
        )}
        {!isWide && detail ? <div className="mt-4">{detail}</div> : null}
        {items.length > 0 && missing.length ? (
          <p className="mt-2 text-caption text-ink-muted">
            {missing.join(", ")} verisi henüz hazır değil. <OsmLink center={center} />
          </p>
        ) : null}
        {fetchedAt ? (
          <p className="mt-2 text-[0.6875rem] leading-snug text-ink-muted">
            Mekân verisi:{" "}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">
              © OpenStreetMap katkıcıları
            </a>{" "}
            (ODbL), {fetchedDate.format(new Date(fetchedAt))} tarihinde alındı. Sıra: Vikipedi dil sayısı (Wikidata) ya da OSM kaydının ayrıntısı;
            puan verisi yok.{noRanking ? " Vikipedi dil sayıları şu an alınamadı; sıra ada göre." : ""}
          </p>
        ) : null}
      </div>

      {fetchedAt ? (
        <div className="min-w-0 md:col-span-5 md:col-start-8 md:row-start-3">
          <div
            ref={mapBox}
            role={fullScreen ? "dialog" : undefined}
            aria-modal={fullScreen ? true : undefined}
            aria-label={fullScreen ? "Harita" : undefined}
            className={fullScreen ? "fixed inset-0 z-50 bg-paper p-3" : "relative h-[180px] md:h-full"}
          >
            {liveMap ? (
              <PlacesMap
                places={places}
                center={center}
                activeId={activeId}
                selectedId={selectedId}
                onActivate={setActiveId}
                onSelect={onSelectFromMap}
                className="h-full"
              />
            ) : (
              <MapFacade places={places} activeId={activeId} selectedId={selectedId} className="h-full" />
            )}
            {!isWide && !fullScreen ? (
              // On phones the strip is a preview: a tap opens the map full screen.
              <button type="button" onClick={() => setFullScreen(true)} className="absolute inset-0 z-10 flex items-end justify-end rounded-md p-2">
                <span className="inline-flex items-center gap-1.5 rounded-sm border border-rule bg-paper-raised px-2.5 py-1.5 text-caption text-ink">
                  <Maximize2 aria-hidden="true" size={14} strokeWidth={1.5} />
                  Haritayı aç
                </span>
              </button>
            ) : null}
            {fullScreen ? (
              <button
                ref={closeButton}
                type="button"
                onClick={() => setFullScreen(false)}
                className="absolute left-5 top-5 z-20 inline-flex items-center gap-1.5 rounded-sm border border-rule bg-paper-raised px-3 py-2 text-caption text-ink"
              >
                <X aria-hidden="true" size={16} strokeWidth={1.5} />
                Haritayı kapat
              </button>
            ) : null}
            {isWide && detail ? <div className="absolute inset-x-3 bottom-8 z-10 max-h-[70%] overflow-y-auto">{detail}</div> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function OsmLink({ center }: { center: { lat: number; lon: number } }) {
  return (
    <a href={osmUrl(center)} target="_blank" rel="noopener noreferrer" className="text-caption text-sea underline">
      Bölgeye OpenStreetMap&apos;te bak
    </a>
  );
}

function EmptyState({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-rule px-5 py-6">
      <p className="text-body text-ink-muted">{text}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

