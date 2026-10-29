"use client";

import { Chip } from "@/components/ui";
import { BUDGET_CURRENCIES, currencyLabel, type BudgetCurrency } from "@/lib/budget/currency";
import { chooseBudgetCurrency, useBudgetCurrency } from "./useBudgetCurrency";

/** DESIGN.md "Currency picker": four small chips in the budget's header (TL, EUR, USD, GBP). Not printed. */
export function BudgetCurrencyPicker({ fromLink }: { fromLink: BudgetCurrency | null }) {
  const chosen = useBudgetCurrency(fromLink);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 print:hidden">
      <span id="butce-para-birimi" className="font-mono text-micro uppercase tracking-[0.08em] text-ink-muted">
        Para birimi
      </span>
      <div role="group" aria-labelledby="butce-para-birimi" className="flex gap-1.5">
        {BUDGET_CURRENCIES.map((code) => (
          <Chip key={code} selected={chosen === code} onClick={() => chooseBudgetCurrency(code)} className="h-8 px-2.5 font-mono">
            {currencyLabel(code)}
          </Chip>
        ))}
      </div>
    </div>
  );
}
