"use client";

import { useBudgetCurrency } from "@/components/budget/useBudgetCurrency";
import { Caption } from "@/components/ui";
import { cn } from "@/lib/cn";
import { effectiveCurrency, type BudgetCurrency } from "@/lib/budget/currency";
import { formatCrossRate, formatSourceDates } from "@/lib/rates/format";
import { SOURCES, type RateTable } from "@/lib/rates/types";

type Props = {
  /** The destination's currency. */
  local: string;
  rates: RateTable;
  /** `?cur=` when the link names a budget currency. */
  fromLink: BudgetCurrency | null;
  className?: string;
};

/**
 * "1 EUR = 55,62 ₺ · TCMB · 16 Eki", or in the budget's currency: "1 EUR = 1,08 USD · TCMB · 29 Eki" (through
 * TRY, like the budget). Nothing when the budget is in the destination's own currency.
 */
export function MastheadRate({ local, rates, fromLink, className }: Props) {
  const cur = effectiveCurrency(useBudgetCurrency(fromLink), rates);
  if (local === cur) return null;
  const localRate = rates[local];
  if (!localRate) {
    return (
      <Caption as="p" tone="warn" className={className}>
        {local} kuru şu an alınamadı · TCMB, Frankfurter ve Exchange Rate API cevap vermedi
      </Caption>
    );
  }
  const target = cur === "TRY" ? null : rates[cur];
  const used = target ? [localRate, target] : [localRate];
  return (
    <Caption as="p" tone="ink" className={cn("flex flex-wrap gap-x-3 gap-y-1", className)}>
      <span>
        {formatCrossRate(local, localRate.tryPerUnit, cur, target?.tryPerUnit ?? 1)} · {formatSourceDates(used)}
      </span>
      {used.some((r) => r.sourceId === "erapi") ? (
        // Attribution required by the open access terms of exchangerate-api.com.
        <a href={SOURCES.erapi.url} target="_blank" rel="noopener noreferrer" className="text-ink-muted underline">
          Rates By Exchange Rate API
        </a>
      ) : null}
    </Caption>
  );
}
