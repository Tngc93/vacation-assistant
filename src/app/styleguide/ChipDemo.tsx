"use client";

import {
  Beer,
  Coffee,
  Eye,
  Landmark,
  Martini,
  Mountain,
  Music,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Chip } from "@/components/ui";

const CATEGORIES: ReadonlyArray<{ id: string; label: string; Icon: LucideIcon }> = [
  { id: "see", label: "Görülecek yer", Icon: Eye },
  { id: "museum", label: "Müze", Icon: Landmark },
  { id: "viewpoint", label: "Manzara noktası", Icon: Mountain },
  { id: "restaurant", label: "Restoran", Icon: Utensils },
  { id: "cafe", label: "Kafe", Icon: Coffee },
  { id: "cocktail", label: "Kokteyl bar", Icon: Martini },
  { id: "pub", label: "Bar ve pub", Icon: Beer },
  { id: "club", label: "Gece kulübü", Icon: Music },
];

export function ChipDemo() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(["see", "museum"]));

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div role="group" aria-label="Kategori filtreleri" className="flex flex-wrap gap-2">
      {CATEGORIES.map(({ id, label, Icon }) => (
        <Chip
          key={id}
          selected={selected.has(id)}
          onClick={() => toggle(id)}
          icon={<Icon size={14} strokeWidth={1.5} />}
        >
          {label}
        </Chip>
      ))}
    </div>
  );
}
