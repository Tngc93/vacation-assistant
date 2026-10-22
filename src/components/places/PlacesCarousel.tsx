"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Caption } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CATEGORIES, type CategoryId } from "@/lib/places/categories";
import type { StoredPlace } from "@/lib/places/file";
import { parseOpeningHours, todayStatus } from "@/lib/places/hours";
import type { ShownPlace } from "@/lib/places/rules";
import { cardPhotoSrcSet } from "@/lib/places/photos";
import { walkToCentre } from "@/lib/places/walk";
import { useMinuteNow } from "@/lib/time/clock";
import { CATEGORY_ICONS } from "./categoryIcons";

export type CarouselItem = {
  place: StoredPlace & Pick<ShownPlace, "remote">;
  category: CategoryId;
  /** 1-based position within its category's ranked list. */
  rank: number;
};

type Props = {
  items: readonly CarouselItem[];
  center: { lat: number; lon: number };
  timeZone: string;
  activeId: string | null;
  selectedId: string | null;
  onActivate: (id: string | null) => void;
  onSelect: (id: string) => void;
  /** Bumped with an id when the map picks a place: the carousel brings that card into view. */
  reveal: { id: string; n: number } | null;
};

const pad = (n: number) => String(n).padStart(2, "0");

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/**
 * The places as a scroll-snap carousel: three cards at a time on wide screens, one (with the next one's edge)
 * on phones. Arrow buttons, keyboard arrows and a counter ("01 / 24"); no animation with reduced motion.
 */
export function PlacesCarousel({ items, center, timeZone, activeId, selectedId, onActivate, onSelect, reveal }: Props) {
  const track = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const [atEnd, setAtEnd] = useState(items.length <= 1);

  const cards = () => Array.from(track.current?.children ?? []) as HTMLElement[];

  const goTo = useCallback((target: number, focus = false) => {
    const el = track.current;
    const list = Array.from(el?.children ?? []) as HTMLElement[];
    if (!el || list.length === 0) return;
    const i = Math.max(0, Math.min(list.length - 1, target));
    el.scrollTo({ left: list[i].offsetLeft, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    if (focus) list[i].querySelector("button")?.focus({ preventScroll: true });
  }, []);

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const list = cards();
    const nearest = list.reduce((best, card, i) => (Math.abs(card.offsetLeft - el.scrollLeft) < Math.abs(list[best].offsetLeft - el.scrollLeft) ? i : best), 0);
    setIndex(nearest);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  };

  // A place picked on the map: bring its card into view.
  useEffect(() => {
    if (!reveal) return;
    const i = items.findIndex((item) => item.place.id === reveal.id);
    if (i >= 0) goTo(i);
  }, [reveal, items, goTo]);

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const list = cards();
    const focused = list.findIndex((card) => card.contains(document.activeElement));
    const from = focused >= 0 ? focused : index;
    goTo(from + (event.key === "ArrowRight" ? 1 : -1), focused >= 0);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul
        ref={track}
        role="list"
        aria-label="Görülecek yerler"
        tabIndex={0}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        className="relative flex min-h-0 flex-1 snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-smooth pb-1 [scrollbar-width:none] motion-reduce:scroll-auto"
      >
        {items.map((item, i) => (
          <li key={item.place.id} className="w-[85%] shrink-0 snap-start md:w-[calc((100%-2rem)/3)]">
            <PlaceTile
              item={item}
              center={center}
              timeZone={timeZone}
              position={i + 1}
              highlighted={activeId === item.place.id || selectedId === item.place.id}
              selected={selectedId === item.place.id}
              onActivate={onActivate}
              onSelect={onSelect}
            />
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-4">
        <Caption as="p" aria-live="polite" className="tabular">
          {pad(Math.min(index + 1, items.length))} / {pad(items.length)}
        </Caption>
        <div className="flex gap-2">
          <ArrowButton label="Önceki yer" disabled={index === 0} onClick={() => goTo(index - 1)}>
            <ChevronLeft aria-hidden="true" size={16} strokeWidth={1.5} />
          </ArrowButton>
          <ArrowButton label="Sonraki yer" disabled={atEnd} onClick={() => goTo(index + 1)}>
            <ChevronRight aria-hidden="true" size={16} strokeWidth={1.5} />
          </ArrowButton>
        </div>
      </div>
    </div>
  );
}

function ArrowButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-rule bg-paper-raised text-ink transition-colors duration-150 ease-out hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** "BUGÜN AÇIK · 09:00–20:00", computed in the browser only (never stale after hydration). */
function TodayHours({ value, timeZone }: { value: string | undefined; timeZone: string }) {
  const week = useMemo(() => parseOpeningHours(value), [value]);
  const now = useMinuteNow();
  if (!week || !now) return null;
  const status = todayStatus(week, now, timeZone);
  return status ? (
    <Caption as="span" tone={status.open ? "ok" : "muted"} className="mt-1 block">
      {status.text}
    </Caption>
  ) : null;
}

/** "Fotoğraf: Canaan · CC BY-SA 4.0 · Wikimedia Commons" (the card's aria-label; the details link both). */
export function photoCredit(photo: { author: string; license: string }): string {
  return `Fotoğraf: ${photo.author} · ${photo.license} · Wikimedia Commons`;
}

/**
 * A place card: the Commons photo (duotone, like the city photo) over the top ~60%, or, without one, a large
 * category icon with the Wikidata description (else the address); below, "MUTLAKA GÖR · NN" for sights, the
 * name, the category, the walk to the centre and today's hours. Every card has the same height. The whole card
 * is one button that selects the place; the photo credit is in its label and in the details, not on the card.
 */
function PlaceTile({
  item,
  center,
  timeZone,
  position,
  highlighted,
  selected,
  onActivate,
  onSelect,
}: {
  item: CarouselItem;
  center: { lat: number; lon: number };
  timeZone: string;
  position: number;
  highlighted: boolean;
  selected: boolean;
  onActivate: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const { place, category, rank } = item;
  const Icon = CATEGORY_ICONS[category];
  const mustSee = category === "see";
  const about = place.description ?? place.address;
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${pad(position)}. ${place.name}, ${CATEGORIES[category].label}${place.photo ? `. ${photoCredit(place.photo)}` : ""}`}
      onClick={() => onSelect(place.id)}
      onMouseEnter={() => onActivate(place.id)}
      onMouseLeave={() => onActivate(null)}
      onFocus={() => onActivate(place.id)}
      onBlur={() => onActivate(null)}
      className={cn(
        "flex h-[22rem] w-full flex-col overflow-hidden rounded-md border bg-paper-raised text-left transition-colors duration-150 ease-out md:h-full",
        highlighted ? "border-accent" : "border-rule hover:border-ink",
      )}
    >
      <span className="relative block h-[58%] min-h-32 shrink-0 overflow-hidden border-b border-rule">
        {place.photo ? (
          <span className="duotone block h-full">
            {/* Commons serves sized thumbnails itself; next/image optimisation would add nothing. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={place.photo.src}
              srcSet={cardPhotoSrcSet(place.photo) || undefined}
              sizes="(min-width: 768px) 14rem, 85vw"
              width={place.photo.width}
              height={place.photo.height}
              alt=""
              loading={position <= 3 ? "eager" : "lazy"}
              // On phones the first card's photo is the largest paint; the second and third wait their turn.
              fetchPriority={position === 1 ? "auto" : "low"}
              decoding="async"
              className="h-full w-full object-cover"
            />
          </span>
        ) : (
          <span className="flex h-full flex-col justify-between gap-2 bg-paper px-4 pb-3 pt-10">
            <Icon aria-hidden="true" size={40} strokeWidth={1.5} className="text-ink-muted" />
            {about ? <span className="line-clamp-3 block text-caption text-ink-muted">{about}</span> : null}
          </span>
        )}
        <span aria-hidden="true" className="absolute left-3 top-3 rounded-sm bg-paper-raised px-1.5 py-0.5 font-mono text-micro tabular text-ink">
          {pad(rank)}
        </span>
      </span>
      <span className="flex min-h-0 flex-1 flex-col p-4">
        {mustSee ? (
          <Caption as="span" tone="ink" className="block">
            MUTLAKA GÖR · {pad(rank)}
          </Caption>
        ) : null}
        <span className="mt-1 line-clamp-2 block font-display text-heading leading-tight text-ink">{place.name}</span>
        <Caption as="span" className="mt-auto block pt-2">
          {CATEGORIES[category].label} · {place.remote ? "MERKEZE UZAK" : walkToCentre(place, center)}
        </Caption>
        <TodayHours value={place.openingHours} timeZone={timeZone} />
      </span>
    </button>
  );
}
