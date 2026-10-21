"use client";

import { ArrowUpRight, RotateCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { buttonClasses, Caption, Skeleton } from "@/components/ui";
import { AiError } from "@/lib/ai/errors";
import { listModels, type Connection, type ModelInfo, type ProviderId } from "@/lib/ai/providers";
import { parseWebCache, readWebCacheRaw, subscribeWebCache, writeWebCache, type WebKind } from "@/lib/ai/webCache";
import { httpsUrl, type FlightOffer, type GroundedAnswer, type StayArea, type WebLink, type WebPrices } from "@/lib/ai/webPrices";
import { demoWebSearchFetcher } from "@/lib/ai/mockProvider";
import { errorNotice, NoticeText, type Notice } from "./notice";
import { useAiConnection } from "./useAiConnection";

/** The keyless demo's connection: no key, the mock provider answers (never the network). */
const DEMO_CONNECTION: Connection = { provider: "openai", key: "", model: "örnek" };

/** The connection to search with, the demo's when the demo is on, or null (not connected). */
export function useSearchConnection(demo: boolean): { conn: Connection; fetcher?: typeof fetch } | null {
  const connection = useAiConnection();
  if (demo) return { conn: DEMO_CONNECTION, fetcher: demoWebSearchFetcher };
  return connection ? { conn: connection } : null;
}

type Results = { flights: WebPrices<FlightOffer>; stays: WebPrices<StayArea> };

/**
 * One search's state: the cached result for this search (sessionStorage, read after hydration), a lock while a
 * request runs (a second click never spends another search), and the error with its caption. When storage is
 * blocked the last result is still shown, from memory.
 */
export function useWebSearch<K extends WebKind>(kind: K, cacheKey: string, run: () => Promise<Results[K]>) {
  const raw = useSyncExternalStore(subscribeWebCache, () => readWebCacheRaw(cacheKey), serverSnapshot);
  const cached = useMemo(() => parseWebCache(kind, raw), [kind, raw]);
  const [unstored, setUnstored] = useState<{ key: string; value: Results[K] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Notice | null>(null);
  const inFlight = useRef(false);

  const search = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const next = await run();
      setUnstored(writeWebCache(cacheKey, next) ? null : { key: cacheKey, value: next });
    } catch (e) {
      setError(errorNotice(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [cacheKey, run]);

  const result = unstored?.key === cacheKey ? unstored.value : cached;
  return { result, busy, error, search };
}

const serverSnapshot = () => null;

const searchedAtFormat = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/Istanbul",
});

/** "YAPAY ZEKÂ WEB'DEN BULDU · SATIN ALMADAN ÖNCE DOĞRULA · Google Gemini · gemini-2.5-flash · 21 Eki 21:40" */
export function WebSourceCaption({ result }: { result: Pick<WebPrices<unknown>, "source" | "searchedAt"> }) {
  return (
    <Caption as="p">
      YAPAY ZEKÂ WEB&apos;DEN BULDU · SATIN ALMADAN ÖNCE DOĞRULA · {/* Names and model ids: uppercased by English rules (GEMINI, not GEMİNİ). */}
      <span lang="en">{result.source}</span> · {searchedAtFormat.format(result.searchedAt)}
    </Caption>
  );
}

export function SampleBanner() {
  return (
    <Caption as="p" tone="warn" className="rounded-sm border border-warn px-3 py-2">
      ÖRNEK VERİ · ÖRNEK SAĞLAYICI · GERÇEK FİYAT DEĞİL
    </Caption>
  );
}

/** A page the provider listed: opened by the person in a new tab; the app never requests it. */
export function SourceLink({ link, children }: { link: WebLink; children?: ReactNode }) {
  return (
    <a href={link.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-caption underline underline-offset-4">
      {children ?? `Kaynak: ${link.host}`}
      <ArrowUpRight aria-hidden="true" size={14} strokeWidth={1.5} />
    </a>
  );
}

/** Anything that could run or navigate on its own; Google's Search Suggestions are only HTML and CSS. */
function activeContent(doc: Document): boolean {
  if (doc.querySelector("script, iframe, frame, object, embed, form, base, meta, link")) return true;
  return [...doc.querySelectorAll("*")].some((el) =>
    [...el.attributes].some((a) => /^on/i.test(a.name) || (/^(href|src|xlink:href|action)$/i.test(a.name) && !/^(https:|#|data:image\/)/i.test(a.value.trim()))),
  );
}

/**
 * Gemini's Search Suggestions (`searchEntryPoint.renderedContent`), shown as Google gave them. The terms
 * (https://ai.google.dev/gemini-api/terms#grounding-with-google-search) forbid modifying or framing them, and
 * Google's guide (docs.cloud.google.com/vertex-ai/generative-ai/docs/grounding/grounding-search-suggestions,
 * checked 2026-10-21) asks for them exactly as provided (colours, fonts), as wide as the grounded answer, a tap
 * going straight to the Search results page. So the HTML and CSS go unchanged into a shadow root: no frame, our
 * styles cannot reach them and theirs cannot leak out. Its inline <style> is allowed by our CSP (style-src
 * 'unsafe-inline'). The content is checked first, without changing it: if it ever held scripts, event handlers or
 * non-https links, it is not inserted and the search queries are shown as plain text instead.
 */
export function SearchSuggestions({ html, queries }: { html: string; queries: readonly string[] }) {
  const host = useRef<HTMLDivElement>(null);
  const safe = useMemo(() => typeof DOMParser !== "undefined" && !activeContent(new DOMParser().parseFromString(html, "text/html")), [html]);
  useEffect(() => {
    const el = host.current;
    if (!el || !safe) return;
    const root = el.shadowRoot ?? el.attachShadow({ mode: "open" });
    root.innerHTML = html;
  }, [html, safe]);
  if (!safe) {
    return queries.length ? <p className="text-caption text-ink-muted">Google araması: {queries.join(" · ")}</p> : null;
  }
  return <div ref={host} data-testid="search-suggestions" className="w-full" />;
}

/** What a search may cost, from each provider's docs (checked 2026-10-21). */
export function CostNote({ provider, demo }: { provider: ProviderId; demo: boolean }) {
  if (demo) return <p className="text-caption text-ink-muted">Örnek sağlayıcı: arama yapılmaz, ücret yok.</p>;
  if (provider === "gemini") {
    return (
      <p className="text-caption text-ink-muted">
        Ücretsiz katmanda günlük arama sınırı var. Gemini 2.5 Flash ve Flash-Lite için ikisine ortak günde 500 istek; Gemini 3 modelleri
        ücretsiz katmanda web araması yapmıyor.
      </p>
    );
  }
  return (
    <p className="text-caption text-ink-muted">
      Web araması kendi hesabından ücretlendirilebilir. {provider === "anthropic" ? "Anthropic" : "OpenAI"}: 1.000 aramada 10 $, model kullanımı ayrıca.
    </p>
  );
}

/** The search / search-again button, locked while a request runs, with the cost note under it. */
export function SearchButton({
  label,
  busy,
  done,
  onSearch,
  provider,
  demo,
}: {
  label: string;
  busy: boolean;
  done: boolean;
  onSearch: () => void;
  provider: ProviderId;
  demo: boolean;
}) {
  return (
    <div className="grid gap-2">
      <div>
        {/* May wrap: a long label never widens the page on a phone. */}
        <button
          type="button"
          onClick={onSearch}
          disabled={busy}
          aria-busy={busy}
          className={buttonClasses({ variant: "secondary", wrap: true, className: "w-full sm:w-auto" })}
        >
          {done ? <RotateCw aria-hidden="true" size={16} strokeWidth={1.5} /> : <Search aria-hidden="true" size={16} strokeWidth={1.5} />}
          {busy ? "Web'de aranıyor…" : done ? "Yeniden ara" : label}
        </button>
      </div>
      <CostNote provider={provider} demo={demo} />
    </div>
  );
}

export function SearchSkeleton({ rows }: { rows: number }) {
  return (
    <div role="status" className="grid gap-3">
      <span className="sr-only">Web&apos;de aranıyor</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="rounded-md border border-dashed border-rule p-5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-3 h-6 w-28" />
        </div>
      ))}
    </div>
  );
}

/** What every finished search shows around its results: the sample banner, the source line, dropped results. */
export function ResultFrame({ result, children }: { result: WebPrices<unknown>; children: ReactNode }) {
  return (
    <div className="grid gap-3">
      {result.sample ? <SampleBanner /> : null}
      <WebSourceCaption result={result} />
      {result.items.length ? children : <p className="text-body text-ink-muted">Web&apos;de doğrulanabilir bir fiyat bulunamadı.</p>}
      {result.dropped ? (
        <p className="text-caption text-ink-muted">
          Kaynağı aramada bulunan sayfalar arasında olmayan {result.dropped} sonuç gösterilmedi.
        </p>
      ) : null}
    </div>
  );
}

export { NoticeText };

/**
 * Gemini's grounded search: in memory only (no storage, a reload loses it), the request locked while it runs.
 * When the chosen model has no Google Search on the free tier, finds a Gemini 2.5 Flash in the key's own model
 * list (by family, not a fixed id) so this one search can be run with it; the connection keeps its model.
 */
export function useGroundedSearch(conn: Connection, run: (conn: Connection) => Promise<GroundedAnswer>, fetcher?: typeof fetch) {
  const [result, setResult] = useState<GroundedAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Notice | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const inFlight = useRef(false);

  const search = useCallback(
    async (model?: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setError(null);
      setFallback(null);
      try {
        setResult(await run(model ? { ...conn, model } : conn));
      } catch (e) {
        const used = model ?? conn.model;
        // A bare quota error on a search with a model outside the 2.5 family: Gemini 3 has no free-tier search.
        const noFreeSearch = e instanceof AiError && conn.provider === "gemini" && (e.kind === "freeTier" || (e.kind === "quotaUnknown" && !GEMINI_25.test(used)));
        setError(noFreeSearch && e.kind === "quotaUnknown" ? { ...errorNotice(e), text: NO_FREE_SEARCH } : errorNotice(e));
        if (noFreeSearch) {
          const models = await listModels("gemini", conn.key, fetcher).catch(() => []);
          setFallback(freeTierSearchModel(models, used));
        }
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [conn, run, fetcher],
  );
  return { result, busy, error, fallback, search };
}

/** Gemini 2.5 family (the free tier's only models with Google Search, pricing page 2026-10-19). */
const GEMINI_25 = /^gemini-2\.5-/;
const NO_FREE_SEARCH = "Google bu aramaya kota sınırı uyguladı. Gemini 3 modelleri ücretsiz katmanda web araması yapamıyor.";

/** A Gemini 2.5 Flash (not Lite, not a preview) from the key's list, other than the model that just failed. */
export function freeTierSearchModel(models: readonly ModelInfo[], failed: string): string | null {
  return models.find((m) => /^gemini-2\.5-flash(-\d{3})?$/.test(m.id) && m.id !== failed)?.id ?? null;
}

/**
 * Gemini's answer as it came: the text unchanged (plain text, line breaks kept), the grounding links as Google
 * gave them, and the Search Suggestions, all the same width. Our caption sits above and our note below, outside it.
 */
export function GroundedResult({ result }: { result: GroundedAnswer }) {
  return (
    <div className="grid gap-3">
      <WebSourceCaption result={result} />
      <div data-testid="grounded-result" className="grid gap-3 rounded-md border border-dashed border-rule bg-paper p-4">
        <p data-testid="grounded-text" className="whitespace-pre-wrap break-words text-body">
          {result.text}
        </p>
        {result.links.length ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {result.links.map((link, i) => (
              <li key={`${link.url}-${i}`}>
                {httpsUrl(link.url) ? (
                  <a href={link.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-caption underline underline-offset-4">
                    {link.title || link.url}
                    <ArrowUpRight aria-hidden="true" size={14} strokeWidth={1.5} />
                  </a>
                ) : (
                  <span className="text-caption">{link.title || link.url}</span>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        {result.suggestionsHtml ? <SearchSuggestions html={result.suggestionsHtml} queries={result.queries} /> : null}
      </div>
      <p className="text-caption text-ink-muted">Fiyatı doğruladıktan sonra bütçeye kendin yazabilirsin.</p>
    </div>
  );
}

/** The Gemini search block shared by flights and stays. */
export function GroundedSearch({
  label,
  conn,
  run,
  fetcher,
  rows,
}: {
  label: string;
  conn: Connection;
  run: (conn: Connection) => Promise<GroundedAnswer>;
  fetcher?: typeof fetch;
  rows: number;
}) {
  const { result, busy, error, fallback, search } = useGroundedSearch(conn, run, fetcher);
  return (
    <div className="grid gap-4">
      <SearchButton label={label} busy={busy} done={!!result} onSearch={() => search()} provider={conn.provider} demo={false} />
      {error ? (
        <div className="grid gap-2">
          <NoticeText notice={error} alert />
          {fallback ? (
            <div>
              <button type="button" onClick={() => search(fallback)} disabled={busy} className={buttonClasses({ variant: "secondary", wrap: true })}>
                <Search aria-hidden="true" size={16} strokeWidth={1.5} />
                Gemini 2.5 Flash ile ara
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {busy ? <SearchSkeleton rows={rows} /> : result ? <GroundedResult result={result} /> : null}
    </div>
  );
}
