"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Caption } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CATEGORIES, type CategoryId } from "@/lib/places/categories";
import type { StoredPlace } from "@/lib/places/file";
import { parseOpeningHours, todayStatus } from "@/lib/places/hours";
import type { ShownPlace } from "@/lib/places/rules";
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

/**
 * A typographic card (the place files hold no photos): the rank as a large Fraunces numeral, the category icon,
 * the name, the walk to the centre and today's hours. The whole card is one button that selects the place.
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
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${pad(position)}. ${place.name}, ${CATEGORIES[category].label}`}
      onClick={() => onSelect(place.id)}
      onMouseEnter={() => onActivate(place.id)}
      onMouseLeave={() => onActivate(null)}
      onFocus={() => onActivate(place.id)}
      onBlur={() => onActivate(null)}
      className={cn(
        "flex h-full min-h-52 w-full flex-col rounded-md border bg-paper-raised p-4 text-left transition-colors duration-150 ease-out md:min-h-0 md:p-5",
        highlighted ? "border-accent" : "border-rule hover:border-ink",
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span aria-hidden="true" className="font-display text-title leading-none tabular text-ink-muted">
          {pad(rank)}
        </span>
        <Icon aria-hidden="true" size={18} strokeWidth={1.5} className="mt-1 shrink-0 text-ink-muted" />
      </span>
      <span className="mt-auto block pt-4">
        {mustSee ? (
          <Caption as="span" tone="ink" className="block">
            MUTLAKA GÖR · {pad(rank)}
          </Caption>
        ) : null}
        <span className="mt-1 line-clamp-2 block font-display text-heading text-ink">{place.name}</span>
        <Caption as="span" className="mt-1 block">
          {CATEGORIES[category].label}
        </Caption>
        <Caption as="span" tone={place.remote ? "sea" : "muted"} className="mt-1 block">
          {place.remote ? "MERKEZE UZAK · TOPLU TAŞIMA ÖNERİLİR" : walkToCentre(place, center)}
        </Caption>
        <TodayHours value={place.openingHours} timeZone={timeZone} />
      </span>
    </button>
  );
}
