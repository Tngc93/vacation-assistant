"use client";

import { PencilLine } from "lucide-react";
import { useCallback, useState } from "react";
import { Caption } from "@/components/ui";
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
import { convertAmount, currencyLabel, effectiveCurrency, type BudgetCurrency } from "@/lib/budget/currency";
import { formatMinor, roundToWhole } from "@/lib/budget/money";
import { BUDGET_STAY_EVENT } from "@/lib/budget/params";
import { formatMoney } from "@/lib/format";
import { webCacheKey } from "@/lib/ai/webCache";
import { searchGrounded, searchStayPrices, stayMidpoint, type RateTable, type StayArea, type StayQuery } from "@/lib/ai/webPrices";

type Props = {
  query: StayQuery;
  rates: RateTable;
  demo: boolean;
  /** Injected in tests; the browser's fetch otherwise. Calls go straight to the provider, never to our server. */
  fetcher?: typeof fetch;
};

/** PRD 9: nightly price ranges by neighbourhood from the model's web search. Without AI the card stays as it was. */
export function WebStaySearch({ query, rates, demo, fetcher }: Props) {
  const search = useSearchConnection(demo);
  if (!search) return null;
  return search.conn.provider === "gemini" ? (
    <Grounded query={query} conn={search.conn} fetcher={search.fetcher ?? fetcher} />
  ) : (
    <Connected query={query} rates={rates} demo={demo} conn={search.conn} fetcher={search.fetcher ?? fetcher} />
  );
}

/** Gemini: the grounded answer shown as it came (no ranges read out, no lira, no cache, no "Bütçeye yaz"). */
function Grounded({ query, conn, fetcher }: { query: StayQuery; conn: Connection; fetcher?: typeof fetch }) {
  const run = useCallback((c: Connection) => searchGrounded(c, "stays", query, { fetcher, now: Date.now() }), [query, fetcher]);
  return (
    <div className="mt-4">
      <GroundedSearch label="Semte göre fiyat aralığını web'de ara" conn={conn} run={run} fetcher={fetcher} rows={3} />
    </div>
  );
}

function Connected({ query, rates, demo, conn, fetcher }: Props & NonNullable<ReturnType<typeof useSearchConnection>>) {
  const key = webCacheKey("stays", [query.city, query.checkIn, query.checkOut, query.adults]);
  const run = useCallback(() => searchStayPrices(conn, query, rates, { fetcher, now: Date.now(), sample: demo }), [conn, query, rates, fetcher, demo]);
  const { result, busy, error, search } = useWebSearch("stays", key, run);
  const [written, setWritten] = useState<{ ok: boolean; text: string } | null>(null);
  const cur = effectiveCurrency(useBudgetCurrency(null), rates);

  // The middle of the range in the budget's currency; the budget takes it (and writes the link) or says no.
  const write = (area: StayArea) => {
    const minor = stayMidpoint(area, cur, rates);
    if (minor === null) {
      setWritten({ ok: false, text: `${area.currency} kuru alınamadığı için bu aralık bütçeye yazılamadı.` });
      return;
    }
    const event = new CustomEvent(BUDGET_STAY_EVENT, { detail: { minor, currency: cur }, cancelable: true });
    if (window.dispatchEvent(event)) {
      setWritten({ ok: false, text: "Bütçe şu an bu tutarı alamadı; gecelik tutarı Bütçe'de kendin yazabilirsin." });
      return;
    }
    setWritten({ ok: true, text: `${area.name}: gecelik ${formatMoney(minor, cur)} bütçeye yazıldı (aralığın ortası). Bütçe'de değiştirebilirsin.` });
  };

  return (
    <div className="mt-4 grid gap-4">
      <SearchButton label="Semte göre fiyat aralığını web'de ara" busy={busy} done={!!result} onSearch={search} provider={conn.provider} demo={demo} />
      {error ? <NoticeText notice={error} alert /> : null}
      {busy ? (
        <SearchSkeleton rows={3} />
      ) : result ? (
        <ResultFrame result={result}>
          <ul className="grid gap-3">
            {result.items.map((area, i) => (
              <AreaRow key={`${area.name}-${i}`} area={area} cur={cur} rates={rates} onWrite={() => write(area)} />
            ))}
          </ul>
          {written ? (
            <p aria-live="polite" className={written.ok ? "text-caption text-ink" : "text-caption text-warn"}>
              {written.text}
            </p>
          ) : null}
        </ResultFrame>
      ) : null}
    </div>
  );
}

function AreaRow({ area, cur, rates, onWrite }: { area: StayArea; cur: BudgetCurrency; rates: RateTable; onWrite: () => void }) {
  const foreign = area.currency !== cur;
  const shown = (minor: number) => {
    const converted = convertAmount(minor, area.currency, cur, rates);
    return converted === null ? null : roundToWhole(converted);
  };
  const min = shown(area.minMinor);
  const max = shown(area.maxMinor);
  const convertible = min !== null && max !== null;
  // The rates between the site's currency and the budget's (through TRY).
  const sources = [...new Set([area.currency, cur].flatMap((c) => (c === "TRY" ? [] : (rates[c]?.sourceName ?? []))))];
  return (
    <li className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 rounded-md border border-dashed border-rule bg-paper px-4 py-3">
      <div className="min-w-0">
        <p className="text-body">{area.name}</p>
        <p className="mt-1 font-mono text-body tabular">
          {convertible ? `${formatMoney(min, cur)} – ${formatMoney(max, cur)}` : `${formatMinor(area.minMinor, area.currency)} – ${formatMinor(area.maxMinor, area.currency)}`}
          <span className="text-caption text-ink-muted"> / gece</span>
        </p>
        <Caption as="p" className="mt-0.5">
          {foreign && convertible ? `SİTEDE ${formatMinor(area.minMinor, area.currency)} – ${formatMinor(area.maxMinor, area.currency)} · ` : ""}
          {convertible
            ? foreign
              ? `KUR: ${sources.join(" · ").toLocaleUpperCase("tr")} · TAHMİNİ`
              : "TAHMİNİ"
            : `${area.currency} KURU ALINAMADI · ${currencyLabel(cur)} KARŞILIĞI YOK`}
        </Caption>
        <div className="mt-1">
          <SourceLink link={area.link} />
        </div>
      </div>
      <button
        type="button"
        onClick={onWrite}
        className="inline-flex items-center gap-1 text-caption text-ink-muted underline underline-offset-4 hover:text-ink"
      >
        <PencilLine aria-hidden="true" size={14} strokeWidth={1.5} />
        Bütçeye yaz
      </button>
    </li>
  );
}
