import { Caption, Skeleton } from "@/components/ui";
import { formatRateLine, getRate, SOURCES, type RateResult } from "@/lib/rates";
import { cn } from "@/lib/cn";

/** Mono line with the TRY rate for a currency and its source. Renders nothing for TRY itself. */
export async function RateLine({ currency, className }: { currency: string; className?: string }) {
  if (currency === "TRY") return null;
  const rate = await getRate(currency);
  return <RateText rate={rate} className={className} />;
}

export function RateText({ rate, className }: { rate: RateResult; className?: string }) {
  if (!rate.ok) {
    return (
      <Caption as="p" tone="warn" className={className}>
        {rate.currency} kuru şu an alınamadı · TCMB, Frankfurter ve Exchange Rate API cevap vermedi
      </Caption>
    );
  }
  return (
    <Caption as="p" tone="ink" className={cn("flex flex-wrap gap-x-3 gap-y-1", className)}>
      <span>{formatRateLine(rate)}</span>
      {rate.source.id === "erapi" ? (
        // Attribution required by the open access terms of exchangerate-api.com.
        <a href={SOURCES.erapi.url} target="_blank" rel="noopener noreferrer" className="text-ink-muted underline">
          Rates By Exchange Rate API
        </a>
      ) : null}
    </Caption>
  );
}

export function RateLineFallback({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <Skeleton className="h-3 w-56" />
    </div>
  );
}
