"use client";

import { Chip } from "@/components/ui";
import { CATEGORIES, CATEGORY_IDS, type CategoryId } from "@/lib/places/categories";
import { CATEGORY_ICONS } from "./categoryIcons";

export type CategoryChipsProps = {
  selected: readonly CategoryId[];
  onToggle: (id: CategoryId) => void;
  disabled?: boolean;
};

/** Square-cornered filter chips with Lucide icons; selected chips are ink-filled. */
export function CategoryChips({ selected, onToggle, disabled }: CategoryChipsProps) {
  return (
    <div role="group" aria-label="Mekân kategorileri" className="flex flex-wrap gap-2">
      {CATEGORY_IDS.map((id) => {
        const Icon = CATEGORY_ICONS[id];
        return (
          <Chip
            key={id}
            selected={selected.includes(id)}
            onClick={() => onToggle(id)}
            disabled={disabled}
            icon={<Icon size={14} strokeWidth={1.5} />}
          >
            {CATEGORIES[id].label}
          </Chip>
        );
      })}
    </div>
  );
}
