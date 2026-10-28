"use client";

import { CalendarDays } from "lucide-react";
import { Chip } from "@/components/ui";
import { CATEGORIES, CATEGORY_IDS, type CategoryId } from "@/lib/places/categories";
import { CATEGORY_ICONS } from "./categoryIcons";

export type CategoryChipsProps = {
  selected: readonly CategoryId[];
  onToggle: (id: CategoryId) => void;
  disabled?: boolean;
  /** The "Etkinlik" chip, first in the row; only when an event falls in the trip's dates. */
  events?: { selected: boolean; onToggle: () => void };
};

/** Square-cornered filter chips with Lucide icons; selected chips are ink-filled. */
export function CategoryChips({ selected, onToggle, disabled, events }: CategoryChipsProps) {
  return (
    // Phones: one row that scrolls sideways, fading at the right edge as a hint; wider screens wrap.
    <div
      role="group"
      aria-label="Mekân kategorileri"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 [mask-image:linear-gradient(to_right,black_85%,transparent)] [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:[mask-image:none]"
    >
      {events ? (
        <Chip
          selected={events.selected}
          onClick={events.onToggle}
          disabled={disabled}
          icon={<CalendarDays size={14} strokeWidth={1.5} />}
          className="shrink-0"
        >
          Etkinlik
        </Chip>
      ) : null}
      {CATEGORY_IDS.map((id) => {
        const Icon = CATEGORY_ICONS[id];
        return (
          <Chip
            key={id}
            selected={selected.includes(id)}
            onClick={() => onToggle(id)}
            disabled={disabled}
            icon={<Icon size={14} strokeWidth={1.5} />}
            className="shrink-0"
          >
            {CATEGORIES[id].label}
          </Chip>
        );
      })}
    </div>
  );
}
