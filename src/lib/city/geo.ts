const coordinate = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "41,38° K · 2,18° D" — Turkish compass letters (Kuzey/Güney, Doğu/Batı). */
export function formatCoordinates(lat: number, lon: number): string {
  const ns = `${coordinate.format(Math.abs(lat))}° ${lat >= 0 ? "K" : "G"}`;
  const ew = `${coordinate.format(Math.abs(lon))}° ${lon >= 0 ? "D" : "B"}`;
  return `${ns} · ${ew}`;
}

/** "14:05" in the city's own time zone. */
export function formatLocalTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(date);
}
