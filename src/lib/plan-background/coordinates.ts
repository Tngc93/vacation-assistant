import type { I18n } from "@/i18n/i18n";

/**
 * One coordinate in whole degrees and minutes with the language's compass letter: "41°23′ K" (Turkish: Kuzey,
 * Güney, Doğu, Batı), "41°23′ N" (English). Minutes are rounded, so 41.9999 is "42°00′".
 */
export function degreesMinutes(value: number, axis: "lat" | "lon", { m, f }: Pick<I18n, "m" | "f">): string {
  const total = Math.round(Math.abs(value) * 60);
  const degrees = Math.floor(total / 60);
  const minutes = String(total % 60).padStart(2, "0");
  const c = m.city.compass;
  const hemisphere = axis === "lat" ? (value >= 0 ? c.north : c.south) : value >= 0 ? c.east : c.west;
  return f(m.city.degreesMinutes, { degrees, minutes, hemisphere });
}
