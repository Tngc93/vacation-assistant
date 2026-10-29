import { Skeleton } from "@/components/ui";
import type { BudgetCurrency } from "@/lib/budget/currency";
import { loadRateTable } from "@/lib/rates/table";
import { MastheadRate } from "./MastheadRate";

/**
 * Mono line with the destination currency's rate in the budget's currency, and its source. Renders nothing
 * for TRY itself, or when the budget is shown in the destination's own currency.
 */
export async function RateLine({ currency, fromLink, className }: { currency: string; fromLink: BudgetCurrency | null; className?: string }) {
  if (currency === "TRY") return null;
  const rates = await loadRateTable(currency);
  return <MastheadRate local={currency} rates={rates} fromLink={fromLink} className={className} />;
}

export function RateLineFallback({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <Skeleton className="h-3 w-56" />
    </div>
  );
}
