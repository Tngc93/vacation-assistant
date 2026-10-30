"use client";

import { useI18n } from "@/i18n/client";
import { sourceLabel } from "@/lib/rates/format";
import { Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Caption, Ticket } from "@/components/ui";
import {
  GroundedSearch,
  NoticeText,
  ResultFrame,
  SearchButton,
  SearchSkeleton,
  SourceLink,
  useSearchConnection,
  useWebSearch,
} from "@/components/ai/WebSearchParts";
import { useBudgetCurrency } from "@/components/budget/useBudgetCurrency";
import type { Connection } from "@/lib/ai/providers";
import { convertAmount, currencyLabel, effectiveCurrency } from "@/lib/budget/currency";
import { formatMinor, roundToWhole } from "@/lib/budget/money";
import { formatMoney } from "@/lib/format";
import { writeBudgetParams, type WebFlightChoice } from "@/lib/budget/params";
import { cn } from "@/lib/cn";
import { webCacheKey } from "@/lib/ai/webCache";
import { searchFlightPrices, searchGrounded, type FlightOffer, type FlightQuery, type RateTable } from "@/lib/ai/webPrices";

type Props = {
  query: FlightQuery;
  rates: RateTable;
  /** VA_AI_MOCK: the keyless demo with sample answers. */
  demo: boolean;
  /** `?wf=`/`?wfs=`: the web price in the budget, if any. */
  inBudget: WebFlightChoice | null;
  /** Injected in tests; the browser's fetch otherwise. Calls go straight to the provider, never to our server. */
  fetcher?: typeof fetch;
};

/** PRD 8: the model's own web search for flight prices, apart from (and never mixed with) the Travelpayouts list. */
export function WebFlightSearch({ query, rates, demo, inBudget, fetcher }: Props) {
  const { m } = useI18n();
  const search = useSearchConnection(demo);
  return (
    <section aria-labelledby="web-ucus-title" className="mt-10 grid gap-4 print:hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule pb-2">
        <h3 id="web-ucus-title" className="font-display text-heading">
          {m.ai.webFlights.title}
        </h3>
        <Caption>{m.ai.webFlights.apart}</Caption>
      </div>
      {search?.conn.provider === "gemini" ? (
        <Grounded query={query} conn={search.conn} fetcher={search.fetcher ?? fetcher} />
      ) : search ? (
        <Connected query={query} rates={rates} demo={demo} inBudget={inBudget} conn={search.conn} fetcher={search.fetcher ?? fetcher} />
      ) : (
        <p className="text-body text-ink-muted">
          {m.ai.webFlights.connectBefore}{" "}
          <a href="#yapay-zeka" className="text-ink underline underline-offset-4">
            {m.ai.webFlights.connect}
          </a>
        </p>
      )}
    </section>
  );
}

/** Gemini: the grounded answer shown as it came (no prices read out, no lira, no cache, no budget button). */
function Grounded({ query, conn, fetcher }: { query: FlightQuery; conn: Connection; fetcher?: typeof fetch }) {
  const { locale, m, f } = useI18n();
  const t = m.ai.webFlights;
  const run = useCallback(
    (c: Connection) => searchGrounded(c, "flights", query, { fetcher, now: Date.now(), language: locale }),
    [query, fetcher, locale],
  );
  return (
    <div className="grid gap-4">
      <p className="max-w-2xl text-body text-ink-muted">
        {f(t.route, { from: query.fromAirports.join(" / "), to: query.toAirports.join(" / "), count: query.adults })} {t.groundedNote}
      </p>
      <GroundedSearch label={t.search} conn={conn} run={run} fetcher={fetcher} rows={2} />
    </div>
  );
}

function Connected({
  query,
  rates,
  demo,
  inBudget,
  conn,
  fetcher,
}: Props & { conn: NonNullable<ReturnType<typeof useSearchConnection>>["conn"]; fetcher?: typeof fetch }) {
  const { locale, m, f } = useI18n();
  const t = m.ai.webFlights;
  const key = webCacheKey("flights", [locale, query.fromAirports.join("+"), query.toCity, query.depart, query.return, query.adults]);
  const run = useCallback(
    () => searchFlightPrices(conn, query, rates, { fetcher, now: Date.now(), sample: demo, language: locale }),
    [conn, query, rates, fetcher, demo, locale],
  );
  const { result, busy, error, search } = useWebSearch("flights", key, run);
  return (
    <div className="grid gap-4">
      <p className="max-w-2xl text-body text-ink-muted">
        {f(t.route, { from: query.fromAirports.join(" / "), to: query.toAirports.join(" / "), count: query.adults })} {t.note}
      </p>
      <SearchButton label={t.search} busy={busy} done={!!result} onSearch={search} provider={conn.provider} demo={demo} />
      {error ? <NoticeText notice={error} alert /> : null}
      {busy ? (
        <SearchSkeleton rows={2} />
      ) : result ? (
        <ResultFrame result={result}>
          <div className="grid gap-4">
            {result.items.map((offer, i) => (
              <WebOfferCard key={`${offer.link.url}-${i}`} offer={offer} adults={query.adults} rates={rates} inBudget={inBudget} />
            ))}
          </div>
        </ResultFrame>
      ) : null}
    </div>
  );
}

/**
 * Same ticket language as the cached prices, but dashed and never in accent: "EN UCUZ" stays with Travelpayouts.
 * Shown in the budget's currency, from the lira amount the budget keeps (`?wf=`), so the card and the receipt agree.
 */
function WebOfferCard({ offer, adults, rates, inBudget }: { offer: FlightOffer; adults: number; rates: RateTable; inBudget: WebFlightChoice | null }) {
  const i18n = useI18n();
  const { locale, intl, m, f } = i18n;
  const t = m.ai.webFlights;
  const cur = effectiveCurrency(useBudgetCurrency(null), rates);
  const shown = (kurus: number) => roundToWhole(convertAmount(kurus, "TRY", cur, rates) ?? kurus);
  // The rates between the site's currency and the budget's (through TRY); none when they are the same.
  const sources =
    offer.currency === cur
      ? []
      : [...new Set([offer.currency, cur].flatMap((c) => (c === "TRY" || !rates[c] ? [] : [sourceLabel(rates[c].sourceName, i18n)])))];
  const chosen = !!inBudget && offer.tryPerAdult === inBudget.perAdult && offer.link.host === inBudget.host;
  return (
    <Ticket
      stubBeside="md"
      className="border-dashed bg-paper"
      aria-label={f(t.offerLabel, { title: offer.title })}
      stub={
        <div className="flex h-full flex-col gap-3">
          <div>
            <Caption as="p">{t.adultEstimated}</Caption>
            <p className="mt-1 font-mono text-title tabular text-ink">
              {offer.tryPerAdult === null ? "—" : formatMoney(shown(offer.tryPerAdult), cur, locale)}
            </p>
            {offer.tryPerAdult === null ? (
              <Caption as="p" tone="warn" className="mt-0.5">
                {f(t.noRate, { currency: offer.currency, budget: currencyLabel(cur, locale) })}
              </Caption>
            ) : sources.length ? (
              <Caption as="p" className="mt-0.5">
                {f(t.rateSources, { sources: sources.join(" · ").toLocaleUpperCase(intl) })}
              </Caption>
            ) : null}
          </div>
          {offer.tryPerAdult !== null ? (
            <div>
              <Caption as="p">{f(t.total, { count: adults })}</Caption>
              <p className="mt-1 font-mono text-body tabular">{formatMoney(shown(offer.tryPerAdult * adults), cur, locale)}</p>
            </div>
          ) : null}
          <div className="mt-auto">
            <SourceLink link={offer.link}>{f(t.onSite, { host: offer.link.host })}</SourceLink>
          </div>
          {offer.tryPerAdult !== null ? (
            <AddWebFlightButton choice={{ perAdult: offer.tryPerAdult, host: offer.link.host }} inBudget={chosen} />
          ) : null}
        </div>
      }
    >
      <p className="text-body">{offer.title}</p>
      <p className="mt-3 font-mono text-caption tabular text-ink-muted">
        {f(t.sitePrice, {
          price: formatMinor(offer.priceMinor, offer.currency, locale),
          basis: offer.basis === "per_person" ? t.perPerson : f(t.allPassengers, { count: adults }),
        })}
      </p>
    </Ticket>
  );
}

/** Like AddToBudgetButton: puts this web price in the budget (?wf=…&wfs=…) instead of a cached ticket. */
function AddWebFlightButton({ choice, inBudget }: { choice: WebFlightChoice; inBudget: boolean }) {
  const { m } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const add = () => {
    if (inBudget) return;
    const params = writeBudgetParams(new URLSearchParams(window.location.search), { flight: null, webFlight: choice });
    startTransition(() => router.replace(`${window.location.pathname}?${params.toString()}${window.location.hash}`, { scroll: false }));
  };
  return (
    <button
      type="button"
      onClick={add}
      aria-pressed={inBudget}
      aria-busy={pending}
      className={cn("inline-flex items-center gap-1 self-center text-caption underline-offset-4", inBudget ? "text-ink" : "text-ink-muted underline hover:text-ink")}
    >
      {inBudget ? <Check aria-hidden="true" size={14} strokeWidth={1.5} /> : <Plus aria-hidden="true" size={14} strokeWidth={1.5} />}
      {inBudget ? m.flights.inBudget : m.flights.addToBudget}
    </button>
  );
}
