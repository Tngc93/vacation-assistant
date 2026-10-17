import { Beer, Coffee, Eye, Landmark, Martini, Mountain, Music, Utensils, type LucideIcon } from "lucide-react";
import type { CategoryId } from "@/lib/places/categories";

export const CATEGORY_ICONS: Record<CategoryId, LucideIcon> = {
  see: Eye,
  museum: Landmark,
  viewpoint: Mountain,
  restaurant: Utensils,
  cafe: Coffee,
  cocktail: Martini,
  pub: Beer,
  club: Music,
};
