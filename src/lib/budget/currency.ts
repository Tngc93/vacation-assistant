import { convertMinor } from "./money";

/**
 * The budget's currency (Berk, 2026-10-29): TRY, EUR, USD or GBP, chosen in the budget's header.
 *
 * Every conversion goes through TRY: the rate layer (`src/lib/rates/`) gives the price of one unit in TRY
 * (TCMB first), flight prices arrive in TRY, and EUR → USD is `tryPerEUR / tryPerUSD`. One pivot, one formula,
 * no extra requests; and the budget in a currency depends on that currency's rate alone.
 */

export const BUDGET_CURRENCIES = ["TRY", "EUR", "USD", "GBP"] as const;
export type BudgetCurrency = (typeof BUDGET_CURRENCIES)[number];

export type UiLanguage = "tr" | "en";

/**
 * The default for an interface language: TRY in Turkish, EUR in English (Berk, 2026-10-29). The one place to change
 * it. A link's `?cur=` and the visitor's own choice come first.
 */
export function defaultBudgetCurrency(language: UiLanguage = "tr"): BudgetCurrency {
  return language === "en" ? "EUR" : "TRY";
}

export const DEFAULT_BUDGET_CURRENCY = defaultBudgetCurrency();

/** A supported code ("eur" → "EUR"), or null for anything else. */
export function parseBudgetCurrency(raw: unknown): BudgetCurrency | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return (BUDGET_CURRENCIES as readonly string[]).includes(code) ? (code as BudgetCurrency) : null;
}

/** Short label in the picker and in the receipt's heading: "TL" in Turkish, "TRY" in English. */
export function currencyLabel(code: string, language: UiLanguage = "tr"): string {
  return code === "TRY" && language === "tr" ? "TL" : code;
}

/** TRY per unit, by currency (TRY itself is 1); a currency without a rate is absent. */
export type TryRates = Record<string, { tryPerUnit: number }>;

/** The currency the budget is shown in: the chosen one when its rate is known, else TRY (never a guessed rate). */
export function effectiveCurrency(chosen: BudgetCurrency, rates: TryRates): BudgetCurrency {
  return chosen === "TRY" || rates[chosen] ? chosen : "TRY";
}

/** The browser remembers the last currency chosen (localStorage; per visitor, never sent anywhere but in `?cur=`). */
export const CURRENCY_STORAGE_KEY = "va.currency";

export function readRememberedCurrency(): BudgetCurrency | null {
  try {
    return parseBudgetCurrency(window.localStorage.getItem(CURRENCY_STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * Every choice is stored, the default too: the two languages have different defaults, so a visitor who chose TRY
 * keeps it on the English pages.
 */
export function rememberCurrency(code: BudgetCurrency): void {
  try {
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, code);
  } catch {
    // Storage blocked (private mode, quota): the choice still holds for this page.
  }
}

/**
 * Minor units of `from` → minor units of `to`, through TRY; null without both rates (never a guessed one).
 * Cents are kept: a converted entry stays as close to what was typed as the rates allow.
 */
export function convertAmount(minor: number, from: string, to: string, rates: TryRates): number | null {
  if (from === to) return minor;
  const tryPerUnit = (code: string) => (code === "TRY" ? 1 : rates[code]?.tryPerUnit);
  const fromRate = tryPerUnit(from);
  const toRate = tryPerUnit(to);
  return fromRate && toRate ? convertMinor(minor, fromRate, toRate) : null;
}
