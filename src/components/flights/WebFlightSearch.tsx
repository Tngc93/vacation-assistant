"use client";

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
import type { Connection } from "@/lib/ai/providers";
import { formatMinor } from "@/lib/budget/money";
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
  const search = useSearchConnection(demo);
  return (
    <section aria-labelledby="web-ucus-title" className="mt-10 grid gap-4 print:hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule pb-2">
        <h3 id="web-ucus-title" className="font-display text-heading">
          Web&apos;de ara
        </h3>
        <Caption>YAPAY ZEKÂ · TRAVELPAYOUTS&apos;TAN AYRI</Caption>
      </div>
      {search?.conn.provider === "gemini" ? (
        <Grounded query={query} conn={search.conn} fetcher={search.fetcher ?? fetcher} />
      ) : search ? (
        <Connected query={query} rates={rates} demo={demo} inBudget={inBudget} conn={search.conn} fetcher={search.fetcher ?? fetcher} />
      ) : (
        <p className="text-body text-ink-muted">
          Güncel fiyatı web&apos;de aratmak için{" "}
          <a href="#yapay-zeka" className="text-ink underline underline-offset-4">
            yapay zekâ bağla
          </a>
        </p>
      )}
    </section>
  );
}

/** Gemini: the grounded answer shown as it came (no prices read out, no lira, no cache, no budget button). */
function Grounded({ query, conn, fetcher }: { query: FlightQuery; conn: Connection; fetcher?: typeof fetch }) {
  const run = useCallback((c: Connection) => searchGrounded(c, "flights", query, { fetcher, now: Date.now() }), [query, fetcher]);
  return (
    <div className="grid gap-4">
      <p className="max-w-2xl text-body text-ink-muted">
        {query.fromAirports.join(" / ")} → {query.toAirports.join(" / ")} · {query.adults} yetişkin. Gemini Google&apos;da arar; cevabı ve
        kaynaklarını olduğu gibi gösteririz. Satın alma o sitede.
      </p>
      <GroundedSearch label="Web'de ara" conn={conn} run={run} fetcher={fetcher} rows={2} />
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
  const key = webCacheKey("flights", [query.fromAirports.join("+"), query.toCity, query.depart, query.return, query.adults]);
  const run = useCallback(
    () => searchFlightPrices(conn, query, rates, { fetcher, now: Date.now(), sample: demo }),
    [conn, query, rates, fetcher, demo],
  );
  const { result, busy, error, search } = useWebSearch("flights", key, run);
  return (
    <div className="grid gap-4">
      <p className="max-w-2xl text-body text-ink-muted">
        {query.fromAirports.join(" / ")} → {query.toAirports.join(" / ")} · {query.adults} yetişkin. Model web&apos;de arar; yalnızca
        bulduğu sayfaya linklenebilen fiyatları gösteririz. Satın alma o sitede.
      </p>
      <SearchButton label="Web'de ara" busy={busy} done={!!result} onSearch={search} provider={conn.provider} demo={demo} />
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

/** Same ticket language as the cached prices, but dashed and never in accent: "EN UCUZ" stays with Travelpayouts. */
function WebOfferCard({ offer, adults, rates, inBudget }: { offer: FlightOffer; adults: number; rates: RateTable; inBudget: WebFlightChoice | null }) {
  const rate = rates[offer.currency];
  const chosen = !!inBudget && offer.tryPerAdult === inBudget.perAdult && offer.link.host === inBudget.host;
  return (
    <Ticket
      stubBeside="md"
      className="border-dashed bg-paper"
      aria-label={`${offer.title}, web'de bulunan fiyat`}
      stub={
        <div className="flex h-full flex-col gap-3">
          <div>
            <Caption as="p">1 YETİŞKİN · TAHMİNİ</Caption>
            <p className="mt-1 font-mono text-title tabular text-ink">
              {offer.tryPerAdult === null ? "—" : formatMinor(offer.tryPerAdult, "TRY")}
            </p>
            {offer.tryPerAdult === null ? (
              <Caption as="p" tone="warn" className="mt-0.5">
                {offer.currency} KURU ALINAMADI · TL KARŞILIĞI YOK
              </Caption>
            ) : offer.currency !== "TRY" && rate ? (
              <Caption as="p" className="mt-0.5">
                KUR: {rate.sourceName.toLocaleUpperCase("tr")}
              </Caption>
            ) : null}
          </div>
          {offer.tryPerAdult !== null ? (
            <div>
              <Caption as="p">TAHMİNİ TOPLAM · {adults} YOLCU</Caption>
              <p className="mt-1 font-mono text-body tabular">{formatMinor(offer.tryPerAdult * adults, "TRY")}</p>
            </div>
          ) : null}
          <div className="mt-auto">
            <SourceLink link={offer.link}>Sitede gör · {offer.link.host}</SourceLink>
          </div>
          {offer.tryPerAdult !== null ? (
            <AddWebFlightButton choice={{ perAdult: offer.tryPerAdult, host: offer.link.host }} inBudget={chosen} />
          ) : null}
        </div>
      }
    >
      <p className="text-body">{offer.title}</p>
      <p className="mt-3 font-mono text-caption tabular text-ink-muted">
        Sitedeki fiyat: {formatMinor(offer.priceMinor, offer.currency)} · {offer.basis === "per_person" ? "kişi başı" : `${adults} yolcu toplam`}
      </p>
    </Ticket>
  );
}

/** Like AddToBudgetButton: puts this web price in the budget (?wf=…&wfs=…) instead of a cached ticket. */
function AddWebFlightButton({ choice, inBudget }: { choice: WebFlightChoice; inBudget: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const add = () => {
    if (inBudget) return;
    const params = writeBudgetParams(new URLSearchParams(window.location.search), { flight: null, webFlight: choice });
    startTransition(() => router.replace(`/plan?${params.toString()}${window.location.hash}`, { scroll: false }));
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
      {inBudget ? "Bütçede" : "Bütçeye ekle"}
    </button>
  );
}
