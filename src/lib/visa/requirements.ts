/**
 * Visa requirements from the Passport Index tidy CSV, as a typed union.
 * Raw values: a number of days, "visa free", "visa on arrival", "e-visa",
 * "eta", "visa required", "no admission" and "-1" (own country).
 */
export type VisaRequirement =
  | { kind: "visa-free"; days: number | null }
  | { kind: "visa-on-arrival" }
  | { kind: "e-visa" }
  | { kind: "eta" }
  | { kind: "visa-required" }
  | { kind: "no-admission" }
  | { kind: "unknown"; raw: string | null };

export type VisaKind = VisaRequirement["kind"];

const KNOWN: Record<string, VisaRequirement> = {
  "visa free": { kind: "visa-free", days: null },
  "visa on arrival": { kind: "visa-on-arrival" },
  "e-visa": { kind: "e-visa" },
  eta: { kind: "eta" },
  "visa required": { kind: "visa-required" },
  "no admission": { kind: "no-admission" },
};

/**
 * Maps a raw dataset value. Anything unexpected (new categories, "-1",
 * legacy "covid ban") becomes `unknown` with the raw value kept, so a test
 * can flag it instead of the UI quietly showing a wrong status.
 */
export function parseRequirement(raw: string | null | undefined): VisaRequirement {
  if (raw === null || raw === undefined) return { kind: "unknown", raw: null };
  const value = raw.trim().toLowerCase();
  if (/^\d+$/.test(value)) {
    const days = Number(value);
    return days > 0 ? { kind: "visa-free", days } : { kind: "unknown", raw };
  }
  return KNOWN[value] ?? { kind: "unknown", raw };
}
