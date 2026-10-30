"use client";

import { useI18n } from "@/i18n/client";
import { sourceLabel } from "@/lib/rates/format";
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
  const { locale, m } = useI18n();
  const run = useCallback(
    (c: Connection) => searchGrounded(c, "stays", query, { fetcher, now: Date.now(), language: locale }),
    [query, fetcher, locale],
  );
  return (
    <div className="mt-4">
      <GroundedSearch label={m.ai.webStays.search} conn={conn} run={run} fetcher={fetcher} rows={3} />
    </div>
  );
}

function Connected({ query, rates, demo, conn, fetcher }: Props & NonNullable<ReturnType<typeof useSearchConnection>>) {
  const { locale, m, f } = useI18n();
  const t = m.ai.webStays;
  const key = webCacheKey("stays", [locale, query.city, query.checkIn, query.checkOut, query.adults]);
  const run = useCallback(
    () => searchStayPrices(conn, query, rates, { fetcher, now: Date.now(), sample: demo, language: locale }),
    [conn, query, rates, fetcher, demo, locale],
  );
  const { result, busy, error, search } = useWebSearch("stays", key, run);
  const [written, setWritten] = useState<{ ok: boolean; text: string } | null>(null);
  const cur = effectiveCurrency(useBudgetCurrency(null), rates);

  // The middle of the range in the budget's currency; the budget takes it (and writes the link) or says no.
  const write = (area: StayArea) => {
    const minor = stayMidpoint(area, cur, rates);
    if (minor === null) {
      setWritten({ ok: false, text: f(t.noRate, { currency: area.currency }) });
      return;
    }
    const event = new CustomEvent(BUDGET_STAY_EVENT, { detail: { minor, currency: cur }, cancelable: true });
    if (window.dispatchEvent(event)) {
      setWritten({ ok: false, text: t.notTaken });
      return;
    }
    setWritten({ ok: true, text: f(t.written, { area: area.name, price: formatMoney(minor, cur, locale) }) });
  };

  return (
    <div className="mt-4 grid gap-4">
      <SearchButton label={t.search} busy={busy} done={!!result} onSearch={search} provider={conn.provider} demo={demo} />
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
  const i18n = useI18n();
  const { locale, intl, m, f } = i18n;
  const t = m.ai.webStays;
  const site = (minor: number) => formatMinor(minor, area.currency, locale);
  const foreign = area.currency !== cur;
  const shown = (minor: number) => {
    const converted = convertAmount(minor, area.currency, cur, rates);
    return converted === null ? null : roundToWhole(converted);
  };
  const min = shown(area.minMinor);
  const max = shown(area.maxMinor);
  const convertible = min !== null && max !== null;
  // The rates between the site's currency and the budget's (through TRY).
  const sources = [...new Set([area.currency, cur].flatMap((c) => (c === "TRY" || !rates[c] ? [] : [sourceLabel(rates[c].sourceName, i18n)])))];
  return (
    <li className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 rounded-md border border-dashed border-rule bg-paper px-4 py-3">
      <div className="min-w-0">
        <p className="text-body">{area.name}</p>
        <p className="mt-1 font-mono text-body tabular">
          {convertible ? `${formatMoney(min, cur, locale)} – ${formatMoney(max, cur, locale)}` : `${site(area.minMinor)} – ${site(area.maxMinor)}`}
          <span className="text-caption text-ink-muted">{t.perNight}</span>
        </p>
        <Caption as="p" className="mt-0.5">
          {foreign && convertible ? f(t.onSite, { range: `${site(area.minMinor)} – ${site(area.maxMinor)}` }) : ""}
          {convertible
            ? foreign
              ? f(t.rateEstimated, { sources: sources.join(" · ").toLocaleUpperCase(intl) })
              : t.estimated
            : f(m.ai.webFlights.noRate, { currency: area.currency, budget: currencyLabel(cur, locale) })}
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
        {t.write}
      </button>
    </li>
  );
}
