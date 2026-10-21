"use client";

import { ChevronDown, PencilLine } from "lucide-react";
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
import type { Connection } from "@/lib/ai/providers";
import { formatMinor } from "@/lib/budget/money";
import { BUDGET_STAY_EVENT, writeBudgetParams } from "@/lib/budget/params";
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
  return (
    // Folded away until asked for, like the full flight list.
    <details className="group mt-5 border-t border-rule pt-4">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-caption font-medium text-ink [&::-webkit-details-marker]:hidden">
        <ChevronDown aria-hidden="true" size={16} strokeWidth={1.5} className="transition-transform duration-200 group-open:rotate-180" />
        Web&apos;de ara
      </summary>
      {search.conn.provider === "gemini" ? (
        <Grounded query={query} conn={search.conn} fetcher={search.fetcher ?? fetcher} />
      ) : (
        <Connected query={query} rates={rates} demo={demo} conn={search.conn} fetcher={search.fetcher ?? fetcher} />
      )}
    </details>
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

  const write = (area: StayArea) => {
    const params = new URLSearchParams(window.location.search);
    const currency = params.get("cur")?.toUpperCase() || "TRY";
    const minor = stayMidpoint(area, currency, rates);
    if (minor === null) {
      setWritten({ ok: false, text: `${area.currency} kuru alınamadığı için bu aralık bütçeye yazılamadı.` });
      return;
    }
    const next = writeBudgetParams(params, { stay: minor });
    window.history.replaceState(null, "", `${window.location.pathname}?${next.toString()}${window.location.hash}`);
    window.dispatchEvent(new CustomEvent(BUDGET_STAY_EVENT, { detail: { minor } }));
    setWritten({ ok: true, text: `${area.name}: gecelik ${formatMinor(minor, currency)} bütçeye yazıldı (aralığın ortası). Bütçe'de değiştirebilirsin.` });
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
              <AreaRow key={`${area.name}-${i}`} area={area} rates={rates} onWrite={() => write(area)} />
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

function AreaRow({ area, rates, onWrite }: { area: StayArea; rates: RateTable; onWrite: () => void }) {
  const local = area.currency !== "TRY";
  const convertible = area.tryMin !== null && area.tryMax !== null;
  return (
    <li className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 rounded-md border border-dashed border-rule bg-paper px-4 py-3">
      <div className="min-w-0">
        <p className="text-body">{area.name}</p>
        <p className="mt-1 font-mono text-body tabular">
          {convertible ? `${formatMinor(area.tryMin!, "TRY")} – ${formatMinor(area.tryMax!, "TRY")}` : `${formatMinor(area.minMinor, area.currency)} – ${formatMinor(area.maxMinor, area.currency)}`}
          <span className="text-caption text-ink-muted"> / gece</span>
        </p>
        <Caption as="p" className="mt-0.5">
          {local ? `SİTEDE ${formatMinor(area.minMinor, area.currency)} – ${formatMinor(area.maxMinor, area.currency)} · ` : ""}
          {convertible ? (local ? `KUR: ${rates[area.currency]?.sourceName.toLocaleUpperCase("tr")} · TAHMİNİ` : "TAHMİNİ") : `${area.currency} KURU ALINAMADI · TL KARŞILIĞI YOK`}
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
