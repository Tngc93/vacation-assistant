"use client";

import { ArrowUpRight, RotateCw, Search } from "lucide-react";
import { useCallback, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { buttonClasses, Caption, Skeleton } from "@/components/ui";
import type { Connection, ProviderId } from "@/lib/ai/providers";
import { parseWebCache, readWebCacheRaw, subscribeWebCache, writeWebCache, type WebKind } from "@/lib/ai/webCache";
import type { FlightOffer, StayArea, WebLink, WebPrices } from "@/lib/ai/webPrices";
import { demoWebSearchFetcher } from "@/lib/ai/mockProvider";
import { errorNotice, NoticeText, type Notice } from "./notice";
import { useAiConnection } from "./useAiConnection";

/** The keyless demo's connection: no key, the mock provider answers (never the network). */
const DEMO_CONNECTION: Connection = { provider: "gemini", key: "", model: "örnek" };

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
export function WebSourceCaption({ result }: { result: WebPrices<unknown> }) {
  return (
    <Caption as="p">
      YAPAY ZEKÂ WEB&apos;DEN BULDU · SATIN ALMADAN ÖNCE DOĞRULA · {result.source} · {searchedAtFormat.format(result.searchedAt)}
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

/**
 * Gemini's Search Suggestions, shown unmodified with the grounded result as the Gemini API terms require
 * (ai.google.dev/gemini-api/terms, "Grounding with Google Search"; checked 2026-10-21). Google's HTML and CSS
 * render in a sandboxed frame: no scripts, its styles stay inside, and its links open Google Search in a new tab.
 */
export function SearchSuggestions({ html }: { html: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(64);
  const fit = () => {
    const doc = frame.current?.contentDocument;
    if (doc?.documentElement) setHeight(Math.min(240, Math.max(40, doc.documentElement.scrollHeight)));
  };
  return (
    <div className="grid gap-1">
      <Caption as="p">GOOGLE ARAMA ÖNERİLERİ</Caption>
      <iframe
        ref={frame}
        title="Google arama önerileri"
        // allow-same-origin without allow-scripts: we can measure the height, the frame can run nothing.
        sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
        srcDoc={`<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>body{margin:0}</style></head><body>${html}</body></html>`}
        onLoad={fit}
        style={{ height }}
        className="w-full border-0"
      />
    </div>
  );
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
      {result.suggestionsHtml ? <SearchSuggestions html={result.suggestionsHtml} /> : null}
    </div>
  );
}

export { NoticeText };
