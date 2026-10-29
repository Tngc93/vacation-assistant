"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_BUDGET_CURRENCY,
  parseBudgetCurrency,
  readRememberedCurrency,
  rememberCurrency,
  type BudgetCurrency,
} from "@/lib/budget/currency";

const CHANGE_EVENT = "va:budget-currency";

/** Chosen in this page with the picker; wins over the link, so it holds even when storage is blocked. */
let picked: BudgetCurrency | null = null;

/** The picker's choice, else the link's `?cur=`, else the visitor's last choice, else the default. */
function current(): BudgetCurrency {
  return (
    picked ??
    parseBudgetCurrency(new URLSearchParams(window.location.search).get("cur")) ??
    readRememberedCurrency() ??
    DEFAULT_BUDGET_CURRENCY
  );
}

function subscribe(onChange: () => void) {
  for (const name of [CHANGE_EVENT, "storage", "popstate"]) window.addEventListener(name, onChange);
  return () => {
    for (const name of [CHANGE_EVENT, "storage", "popstate"]) window.removeEventListener(name, onChange);
  };
}

/**
 * The budget's chosen currency, shared by the budget, its picker, the masthead's rate line and the web-search
 * prices. The server (and hydration) use the link's `?cur=`; the remembered choice applies right after.
 */
export function useBudgetCurrency(fromLink: BudgetCurrency | null): BudgetCurrency {
  return useSyncExternalStore(subscribe, current, () => fromLink ?? DEFAULT_BUDGET_CURRENCY);
}

/** The picker: remembered in the browser; the budget converts its amounts and writes `?cur=` with them. */
export function chooseBudgetCurrency(code: BudgetCurrency): void {
  picked = code;
  rememberCurrency(code);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Tests only: forget the picker's choice between tests. */
export function resetPickedCurrency(): void {
  picked = null;
}
