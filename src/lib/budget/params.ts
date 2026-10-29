import { parseBudgetCurrency } from "./currency";
import { amountFromParam, amountToParam } from "./money";

/** `?flight=` value: origin airport, airline + flight number, local departure of each leg. */
export const FLIGHT_REF = /^[A-Z]{3}-[A-Z0-9]{2}\d{1,5}-\d{12}-\d{12}$/;

/**
 * Window event with `{ minor, currency }`: a nightly price written into the budget from outside it (web search).
 * Cancelable: the budget calls `preventDefault()` when it took the price (and wrote the link itself).
 */
export const BUDGET_STAY_EVENT = "va:budget-stay";

/** Window event: a new origin took the chosen flight out of the budget (`writeTripParams`); the budget says so. */
export const BUDGET_FLIGHT_DROPPED_EVENT = "va:budget-flight-dropped";

/** `?wfs=`: the site a web-search price came from (a bare host name, nothing the model wrote). */
export const WEB_HOST = /^(?=.{3,100}$)[a-z0-9-]+(\.[a-z0-9-]+)+$/;

/**
 * A flight price the model found on the web, chosen for the budget (`?wf=` per adult, always in lira like the
 * cached tickets, whatever the budget is shown in; `?wfs=` site).
 */
export type WebFlightChoice = { perAdult: number; host: string };

/** The budget part of the plan URL: &flight=…&wf=…&wfs=…&stay=…&daily=…&cur=… */
export type BudgetParams = {
  /** Chosen ticket; null means "the cheapest on the chosen dates". */
  flight: string | null;
  /** A web-search price instead of a cached ticket (kuruş per adult); `flight` is then null. */
  webFlight: WebFlightChoice | null;
  /** Nightly accommodation for all rooms, in minor units of `cur`. */
  stay: number | null;
  /** Daily spend per person, in minor units of `cur`. */
  daily: number | null;
  /**
   * `?cur=`: the budget's currency, and the currency of `stay` and `daily`; one of TRY, EUR, USD, GBP.
   * Without it (or with an unknown code) the amounts are in TRY, as in every link before the currency picker.
   * Older links may name the destination's own currency (`cur=CZK`): kept, so their amounts are not misread;
   * the budget converts them to the chosen currency.
   */
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
  const rawCur = first(raw, "cur")?.toUpperCase();
  const cur = parseBudgetCurrency(rawCur) ?? (rawCur === localCurrency ? localCurrency : "TRY");
  const webPrice = amountFromParam(first(raw, "wf"));
  const webHost = first(raw, "wfs")?.toLowerCase() ?? "";
  const webFlight = webPrice && WEB_HOST.test(webHost) ? { perAdult: webPrice, host: webHost } : null;
  return {
    flight: !webFlight && flight && FLIGHT_REF.test(flight) ? flight : null,
    webFlight,
    stay: amountFromParam(first(raw, "stay")),
    daily: amountFromParam(first(raw, "daily")),
    cur,
  };
}

/** Writes the budget into existing search params (other params are kept); empty values are removed. */
export function writeBudgetParams(params: URLSearchParams, budget: Partial<BudgetParams>): URLSearchParams {
  const next = new URLSearchParams(params);
  const set = (key: string, value: string | null) => (value ? next.set(key, value) : next.delete(key));
  if ("flight" in budget) set("flight", budget.flight ?? null);
  if ("webFlight" in budget) {
    set("wf", budget.webFlight ? amountToParam(budget.webFlight.perAdult) : null);
    set("wfs", budget.webFlight?.host ?? null);
  }
  if ("stay" in budget) set("stay", budget.stay ? amountToParam(budget.stay) : null);
  if ("daily" in budget) set("daily", budget.daily ? amountToParam(budget.daily) : null);
  if ("cur" in budget) set("cur", budget.cur && budget.cur !== "TRY" ? budget.cur : null);
  return next;
}
