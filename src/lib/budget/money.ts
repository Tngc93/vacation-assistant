/**
 * Money as integer minor units (kuruş, cent): never floating-point sums.
 * User amounts have at most two decimals; rates are applied with BigInt.
 */

/** Largest amount a user can enter (10 million units), so totals stay far inside safe integers. */
export const MAX_INPUT_MINOR = 10_000_000_00;

/** Why a typed amount is refused; the interface words it (messages `budget.amountErrors`). */
export type AmountError = "empty" | "format" | "zero" | "tooLarge";
export type AmountParse = { ok: true; minor: number } | { ok: false; error: AmountError };

/**
 * What a person types: "1250", "1250,5", "1250.50". Digits with at most one
 * decimal separator (comma or dot) and two decimals; no thousands separators.
 * "1.250" is refused rather than guessed (1,25 or 1 250?).
 */
export function parseAmountInput(text: string): AmountParse {
  const value = text.trim().replace(/\s/g, "");
  if (!value) return { ok: false, error: "empty" };
  const match = /^(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(value);
  if (!match) return { ok: false, error: "format" };
  const minor = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (minor <= 0) return { ok: false, error: "zero" };
  if (minor > MAX_INPUT_MINOR) return { ok: false, error: "tooLarge" };
  return { ok: true, minor };
}

/** URL form: "1250", "1250.5", "1250.05". */
export function amountToParam(minor: number): string {
  const whole = Math.floor(minor / 100);
  const cents = minor % 100;
  return cents === 0 ? String(whole) : `${whole}.${String(cents).padStart(2, "0").replace(/0$/, "")}`;
}

/** Reads the URL form back; anything else is ignored (null). */
export function amountFromParam(raw: string | null | undefined): number | null {
  if (!raw || !/^\d{1,9}(\.\d{1,2})?$/.test(raw)) return null;
  const parsed = parseAmountInput(raw);
  return parsed.ok ? parsed.minor : null;
}

/** Input box form: "1250,5" with the Turkish decimal comma, "1250.5" in English. */
export function amountToInput(minor: number, locale: "tr" | "en" = "tr"): string {
  return locale === "tr" ? amountToParam(minor).replace(".", ",") : amountToParam(minor);
}

/** A TRY-per-unit rate as an integer with six decimals (55.618 → 55618000). */
export function rateToMicros(tryPerUnit: number): bigint {
  return BigInt(Math.round(tryPerUnit * 1_000_000));
}

// BigInt(…) rather than literals: tsconfig targets ES2017 (runtime support is universal in Next's browser targets).
const TWO = BigInt(2);
const HUNDRED = BigInt(100);
const MICROS = BigInt(1_000_000);

/** Rounds a non-negative BigInt ratio half up. */
const divRound = (value: bigint, by: bigint) => (value + by / TWO) / by;

/** Local minor units → kuruş at the given rate, rounded half up. */
export function toKurus(localMinor: number, tryPerUnit: number): number {
  return Number(divRound(BigInt(localMinor) * rateToMicros(tryPerUnit), MICROS));
}

/** kuruş → minor units of a currency at the given TRY-per-unit rate, rounded half up. */
export function fromKurus(kurus: number, tryPerUnit: number): number {
  return Number(divRound(BigInt(kurus) * MICROS, rateToMicros(tryPerUnit)));
}

/**
 * Minor units of one currency → minor units of another, through TRY (`tryPerUnit` of each; TRY itself is 1).
 * One BigInt step, rounded half up once: `minor × from ÷ to`.
 */
export function convertMinor(minor: number, fromTryPerUnit: number, toTryPerUnit: number): number {
  return Number(divRound(BigInt(minor) * rateToMicros(fromTryPerUnit), rateToMicros(toTryPerUnit)));
}

/** Whole units, half up, in minor units (12345 → 12300, 12350 → 12400): lira, euro, dollar or pound alike. */
export function roundToWhole(minor: number): number {
  return Number(divRound(BigInt(minor), HUNDRED)) * 100;
}

/** minor ÷ n, rounded half up to whole units. */
export function perPersonWhole(minor: number, people: number): number {
  return Number(divRound(BigInt(minor), BigInt(people) * HUNDRED)) * 100;
}

/** "1.250,50 EUR", "300 EUR" with the ISO code, in Turkish formatting ("1,250.50 EUR" in English). */
export function formatMinor(minor: number, currency: string, locale: "tr" | "en" = "tr"): string {
  const whole = Math.floor(minor / 100);
  const cents = minor % 100;
  const grouped = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-GB", { maximumFractionDigits: 0 }).format(whole);
  const amount = cents ? `${grouped}${locale === "tr" ? "," : "."}${String(cents).padStart(2, "0")}` : grouped;
  return currency === "TRY" ? `${amount} ₺` : `${amount} ${currency}`;
}
