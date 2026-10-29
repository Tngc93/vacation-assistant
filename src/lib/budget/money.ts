/**
 * Money as integer minor units (kuruş, cent): never floating-point sums.
 * User amounts have at most two decimals; rates are applied with BigInt.
 */

/** Largest amount a user can enter (10 million units), so totals stay far inside safe integers. */
export const MAX_INPUT_MINOR = 10_000_000_00;

export type AmountParse = { ok: true; minor: number } | { ok: false; error: string };

/**
 * What a person types: "1250", "1250,5", "1250.50". Digits with at most one
 * decimal separator (comma or dot) and two decimals; no thousands separators.
 * "1.250" is refused rather than guessed (1,25 or 1 250?).
 */
export function parseAmountInput(text: string): AmountParse {
  const value = text.trim().replace(/\s/g, "");
  if (!value) return { ok: false, error: "Tutar gir." };
  const match = /^(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(value);
  if (!match) return { ok: false, error: "Yalnızca rakam ve en fazla iki ondalık (virgülle) yaz." };
  const minor = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (minor <= 0) return { ok: false, error: "Sıfırdan büyük bir tutar gir." };
  if (minor > MAX_INPUT_MINOR) return { ok: false, error: "Tutar çok büyük." };
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

/** Input box form: "1250,5" (Turkish decimal comma). */
export function amountToInput(minor: number): string {
  return amountToParam(minor).replace(".", ",");
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

/** "1.250,50 EUR", "300 EUR" in Turkish formatting with the ISO code. */
export function formatMinor(minor: number, currency: string): string {
  const whole = Math.floor(minor / 100);
  const cents = minor % 100;
  const grouped = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(whole);
  const amount = cents ? `${grouped},${String(cents).padStart(2, "0")}` : grouped;
  return currency === "TRY" ? `${amount} ₺` : `${amount} ${currency}`;
}
