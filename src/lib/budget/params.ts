import { amountFromParam, amountToParam } from "./money";

/** `?flight=` value: origin airport, airline + flight number, local departure of each leg. */
export const FLIGHT_REF = /^[A-Z]{3}-[A-Z0-9]{2}\d{1,5}-\d{12}-\d{12}$/;

/** The budget part of the plan URL: &flight=…&stay=…&daily=…&cur=… */
export type BudgetParams = {
  /** Chosen ticket; null means "the cheapest on the chosen dates". */
  flight: string | null;
  /** Nightly accommodation for all rooms, in minor units of `cur`. */
  stay: number | null;
  /** Daily spend per person, in minor units of `cur`. */
  daily: number | null;
  /** Currency of `stay` and `daily`: TRY or the destination's currency. */
  cur: string;
};

type Raw = Record<string, string | string[] | undefined> | URLSearchParams;
const first = (raw: Raw, key: string) => {
  const value = raw instanceof URLSearchParams ? raw.get(key) : raw[key];
  return (Array.isArray(value) ? value[0] : value) ?? null;
};

/** Unknown or malformed values are dropped, never guessed. */
export function parseBudgetParams(raw: Raw, localCurrency: string): BudgetParams {
  const flight = first(raw, "flight");
  const cur = first(raw, "cur")?.toUpperCase();
  return {
    flight: flight && FLIGHT_REF.test(flight) ? flight : null,
    stay: amountFromParam(first(raw, "stay")),
    daily: amountFromParam(first(raw, "daily")),
    cur: cur === localCurrency ? localCurrency : "TRY",
  };
}

/** Writes the budget into existing search params (other params are kept); empty values are removed. */
export function writeBudgetParams(params: URLSearchParams, budget: Partial<BudgetParams>): URLSearchParams {
  const next = new URLSearchParams(params);
  const set = (key: string, value: string | null) => (value ? next.set(key, value) : next.delete(key));
  if ("flight" in budget) set("flight", budget.flight ?? null);
  if ("stay" in budget) set("stay", budget.stay ? amountToParam(budget.stay) : null);
  if ("daily" in budget) set("daily", budget.daily ? amountToParam(budget.daily) : null);
  if ("cur" in budget) set("cur", budget.cur && budget.cur !== "TRY" ? budget.cur : null);
  return next;
}
