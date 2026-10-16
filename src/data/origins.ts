/** Departure cities supported in phase 1 (PRD 1). */
export const ORIGINS = [
  { code: "IST", nameTr: "İstanbul", airports: ["IST", "SAW"] },
  { code: "ESB", nameTr: "Ankara", airports: ["ESB"] },
] as const;

export type Origin = (typeof ORIGINS)[number];
export type OriginCode = Origin["code"];

export const DEFAULT_ORIGIN: OriginCode = "IST";

export function findOrigin(code: string): Origin | undefined {
  return ORIGINS.find((o) => o.code === code.toUpperCase());
}

/** "IST · SAW" — the airport codes searched for an origin. */
export function originAirportsLabel(origin: Origin): string {
  return origin.airports.join(" · ");
}
