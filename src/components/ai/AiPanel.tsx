"use client";

import { KeyRound, MessageSquare, Sparkles, Trash2, Undo2, X } from "lucide-react";
import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Button, Caption, Chip } from "@/components/ui";
import { requestAiEdit, requestAiPlan, type AiPlan } from "@/lib/ai/assistant";
import type { EditBatch, PlanDiff } from "@/lib/ai/edits";
import { AiError, aiErrorCaption } from "@/lib/ai/errors";
import { errorNotice, NoticeText, type Notice } from "./notice";
import { useAiConnection } from "./useAiConnection";
import { clearConnection, saveConnection, type loadConnection } from "@/lib/ai/keyStore";
import { candidatesFor, dayWindows, type PlanSummaryDay } from "@/lib/ai/prompts";
import { listModels, PROVIDER_IDS, PROVIDERS, suggestModel, type ModelInfo, type ProviderId } from "@/lib/ai/providers";
import { ITINERARY } from "@/lib/itinerary/config";
import type { Itinerary, PlanPlace } from "@/lib/itinerary/plan";
import { CATEGORIES } from "@/lib/places/categories";

type Props = {
  plan: Itinerary;
  daytime: readonly PlanPlace[];
  skip: readonly string[];
  cityName: string;
  pace: "relaxed" | "normal";
  evening: readonly string[];
  onPlan: (plan: AiPlan, source: string) => void;
  onEdit: (batch: EditBatch, reply: string) => void;
  onUndo: () => void;
  canUndo: boolean;
  lastChange: { diff: PlanDiff; reply: string } | null;
  /** Injected in tests; the browser's fetch otherwise. Calls go straight to the provider, never to our server. */
  fetcher?: typeof fetch;
  /** In the side panel or the sheet: the close button. */
  onClose?: () => void;
};

const EXAMPLES = ["2. günü müzesiz yap", "Daha az yürüyelim", "Akşamları kokteyl bar"];

/** PRD 21–26: connect your own provider, let the model plan from the fetched list, edit by chatting. */
export function AiPanel(props: Props) {
  const connection = useAiConnection();
  const [settings, setSettings] = useState(false);

  return (
    <section id="yapay-zeka" aria-labelledby="ai-title" className="scroll-mt-6 rounded-md border border-rule bg-paper-raised p-4 md:p-5 print:hidden">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 pt-2">
          <Sparkles aria-hidden="true" size={16} strokeWidth={1.5} className="shrink-0" />
          <h3 id="ai-title" className="whitespace-nowrap text-body font-medium">
            Yapay zekâ ile planla
          </h3>
          <Caption>İSTEĞE BAĞLI</Caption>
        </div>
        {props.onClose ? (
          <button
            type="button"
            onClick={props.onClose}
            aria-label="Yapay zekâ panelini kapat"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-sm border border-rule text-ink transition-colors duration-150 ease-out hover:border-ink"
          >
            <X aria-hidden="true" size={16} strokeWidth={1.5} />
          </button>
        ) : null}
      </div>
      {connection && !settings ? (
        <button type="button" onClick={() => setSettings(true)} className="mt-2 text-left text-caption text-ink-muted underline underline-offset-4 hover:text-ink">
          {PROVIDERS[connection.provider].label} · {connection.model} · Bağlantı ayarları
        </button>
      ) : null}
      {!connection || settings ? (
        // Opening the settings keeps the form up while connecting, so the model list shows before the assistant does.
        <ConnectForm initial={connection} fetcher={props.fetcher} onStart={() => setSettings(true)} onDone={() => setSettings(false)} />
      ) : (
        <Assistant {...props} connection={connection} />
      )}
    </section>
  );
}

function ConnectForm({
  initial,
  fetcher,
  onStart,
  onDone,
}: {
  initial: ReturnType<typeof loadConnection>;
  fetcher?: typeof fetch;
  onStart: () => void;
  onDone: () => void;
}) {
  const id = useId();
  const [provider, setProvider] = useState<ProviderId>(initial?.provider ?? "gemini");
  const [key, setKey] = useState(initial?.key ?? "");
  const [remember, setRemember] = useState(initial?.remember ?? false);
  const [models, setModels] = useState<ModelInfo[] | null>(null);
  const [model, setModel] = useState(initial?.model ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Notice | null>(null);

  const connect = async (event: FormEvent) => {
    event.preventDefault();
    onStart();
    setError(null);
    setBusy(true);
    try {
      const list = await listModels(provider, key.trim(), fetcher);
      if (!list.length) throw new AiError("model");
      const suggested = list.some((m) => m.id === model) ? model : (suggestModel(provider, list) ?? list[0].id);
      setModels(list);
      setModel(suggested);
      if (!saveConnection({ provider, key: key.trim(), model: suggested }, remember)) {
        setError({ tone: "warn", text: "Tarayıcın bu sitenin depolama alanını engelliyor; anahtar saklanamadı." });
      }
    } catch (e) {
      setError(errorNotice(e));
    } finally {
      setBusy(false);
    }
  };

  const chooseModel = (next: string) => {
    setModel(next);
    saveConnection({ provider, key: key.trim(), model: next }, remember);
  };

  return (
    <div className="mt-4 grid gap-4">
      <p className="text-caption text-ink-muted">
        Anahtarın bu tarayıcıda kalır, sunucumuza gönderilmez. Kullanım senin hesabından ücretlendirilir.
      </p>
      <form onSubmit={connect} className="grid gap-4">
        <fieldset>
          <legend className="text-caption font-medium text-ink">Sağlayıcı</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {PROVIDER_IDS.map((p) => (
              <Chip
                key={p}
                selected={provider === p}
                onClick={() => {
                  setProvider(p);
                  setModels(null);
                }}
              >
                {PROVIDERS[p].label}
              </Chip>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor={`${id}-key`} className="text-caption font-medium text-ink">
            API anahtarı
          </label>
          <div className="mt-1.5 flex h-11 items-center gap-2 rounded-sm border border-rule bg-paper px-3 focus-within:border-ink">
            <KeyRound aria-hidden="true" size={14} strokeWidth={1.5} className="shrink-0 text-ink-muted" />
            <input
              id={`${id}-key`}
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="h-full w-full min-w-0 flex-1 bg-transparent font-mono text-caption text-ink outline-none"
            />
          </div>
          <p className="mt-1 text-caption text-ink-muted">
            {PROVIDER_IDS.map((p, i) => (
              <span key={p}>
                {i ? " · " : ""}
                <a href={PROVIDERS[p].keyPage} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                  {PROVIDERS[p].label} anahtarı al
                </a>
                {PROVIDERS[p].freeTier ? " (ücretsiz katmanı var)" : ""}
              </span>
            ))}
          </p>
        </div>
        {/* The note sits under the label (not beside it), so a narrow panel doesn't split them into two columns. */}
        <label className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-0.5 text-caption text-ink">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-ink" />
          <span>Bu cihazda hatırla</span>
          <span className="col-start-2 text-ink-muted">Kapalıysa anahtar sekme kapanınca silinir.</span>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || !key.trim()}>
            {busy ? "Anahtar deneniyor…" : "Bağlan"}
          </Button>
          {initial ? (
            <Button
              variant="ghost"
              onClick={() => {
                clearConnection();
                setKey("");
                setModels(null);
                onDone();
              }}
            >
              <Trash2 aria-hidden="true" size={16} strokeWidth={1.5} />
              Anahtarı sil
            </Button>
          ) : null}
          {initial && !models ? (
            <Button variant="ghost" onClick={onDone}>
              Vazgeç
            </Button>
          ) : null}
        </div>
      </form>
      {error ? <NoticeText notice={error} alert /> : null}
      {models ? (
        <div>
          <label htmlFor={`${id}-model`} className="text-caption font-medium text-ink">
            Model <span className="font-normal text-ink-muted">(hızlı ve ucuz olanı önerdik; değiştirebilirsin)</span>
          </label>
          <select
            id={`${id}-model`}
            value={model}
            onChange={(e) => chooseModel(e.target.value)}
            className="mt-1.5 h-11 w-full min-w-0 rounded-sm border border-rule bg-paper px-3 font-mono text-caption text-ink"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label === m.id ? m.id : `${m.label} (${m.id})`}
              </option>
            ))}
          </select>
          <Button className="mt-3" variant="secondary" onClick={onDone}>
            Bağlandı, devam et
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Assistant({
  plan,
  daytime,
  skip,
  cityName,
  pace,
  evening,
  onPlan,
  onEdit,
  onUndo,
  canUndo,
  lastChange,
  fetcher,
  connection,
}: Props & { connection: NonNullable<ReturnType<typeof loadConnection>> }) {
  const id = useId();
  const [busy, setBusy] = useState<"plan" | "edit" | null>(null);
  const [status, setStatus] = useState<Notice | null>(null);
  // State updates land after a render; the ref stops a fast second click from sending a second request
  // (and spending the per-minute limit) before the buttons show as locked.
  const inFlight = useRef(false);
  const [request, setRequest] = useState("");
  const days = useMemo(() => dayWindows(plan), [plan]);
  const candidates = useMemo(() => candidatesFor(daytime, days, new Set(skip)), [daytime, days, skip]);
  const source = `${PROVIDERS[connection.provider].label} · ${connection.model}`;

  const makePlan = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy("plan");
    setStatus(null);
    try {
      const maxStops = pace === "relaxed" ? ITINERARY.relaxedMaxDaytimeStops : ITINERARY.maxDaytimeStops;
      const result = await requestAiPlan(connection, { city: cityName, days, candidates, maxStops }, fetcher);
      if (result.ok) {
        onPlan(result.value, source);
        setStatus({ tone: "ink", text: "Plan yapay zekânın seçimiyle güncellendi; saatleri ve yürüme sürelerini uygulama hesapladı." });
      } else if (result.attempts === 0) {
        setStatus({ tone: "warn", text: "Listede seçilecek yer kalmadı; mevcut plan kaldı." });
      } else {
        setStatus({
          tone: "warn",
          text: "Model iki denemede de yalnızca listedeki yerlerle geçerli bir plan veremedi; mevcut plan kaldı.",
          detail: aiErrorCaption(result.error),
        });
      }
    } catch (e) {
      setStatus(errorNotice(e));
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  const edit = async (event: FormEvent) => {
    event.preventDefault();
    const text = request.trim();
    if (!text || inFlight.current) return;
    inFlight.current = true;
    setBusy("edit");
    setStatus(null);
    try {
      const summary: PlanSummaryDay[] = plan.days.map((d) => ({
        day: d.number,
        window: d.daytime ? `${d.daytime.start}-${d.daytime.end}` : null,
        stops: d.stops
          .filter((s) => s.kind === "daytime")
          .map((s) => ({ id: s.shortId, name: s.name, category: CATEGORIES[s.category].label })),
        evening: d.stops.find((s) => s.kind === "evening")?.name ?? null,
      }));
      const result = await requestAiEdit(connection, { request: text, city: cityName, plan: summary, candidates, pace, evening }, fetcher);
      if (result.ok) {
        if (result.value.batch.length) {
          onEdit(result.value.batch, result.value.reply);
          setRequest("");
        } else {
          setStatus({ tone: "ink", text: result.value.reply });
        }
      } else {
        setStatus({ tone: "warn", text: "Model bu isteği geçerli düzenlemelere çeviremedi; plan değişmedi.", detail: aiErrorCaption(result.error) });
      }
    } catch (e) {
      setStatus(errorNotice(e));
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  return (
    <div className="mt-4 grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={makePlan} disabled={busy !== null}>
          <Sparkles aria-hidden="true" size={16} strokeWidth={1.5} />
          {busy === "plan" ? "Plan hazırlanıyor…" : "Yapay zekâyla planla"}
        </Button>
        <p className="text-caption text-ink-muted">Model yalnızca bu şehrin listesinden seçer; saatleri, açılışları ve yürümeyi uygulama hesaplar.</p>
      </div>

      <form onSubmit={edit} className="grid gap-2">
        <label htmlFor={`${id}-chat`} className="flex items-center gap-2 text-caption font-medium text-ink">
          <MessageSquare aria-hidden="true" size={14} strokeWidth={1.5} />
          Planı sohbetle değiştir
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={`${id}-chat`}
            type="text"
            value={request}
            maxLength={500}
            onChange={(e) => setRequest(e.target.value)}
            placeholder={`Örn. ${EXAMPLES.join(" · ")}`}
            className="h-11 w-full min-w-0 flex-1 rounded-sm border border-rule bg-paper px-3 text-body text-ink outline-none focus:border-ink"
          />
          <Button type="submit" variant="secondary" disabled={busy !== null || !request.trim()}>
            {busy === "edit" ? "Düzenleniyor…" : "Uygula"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <Chip key={example} onClick={() => setRequest(example)}>
              {example}
            </Chip>
          ))}
        </div>
      </form>

      <div aria-live="polite" className="grid gap-2">
        {status ? <NoticeText notice={status} /> : null}
        {lastChange ? <ChangeSummary change={lastChange} onUndo={onUndo} canUndo={canUndo} /> : null}
      </div>
    </div>
  );
}

function ChangeSummary({ change, onUndo, canUndo }: { change: { diff: PlanDiff; reply: string }; onUndo: () => void; canUndo: boolean }) {
  const { diff } = change;
  const lines = [
    ...diff.added.map((a) => `Eklendi: ${a.name} (${a.day}. gün)`),
    ...diff.removed.map((r) => `Çıkarıldı: ${r.name} (${r.day}. gün)`),
    ...diff.moved.map((m) => `Taşındı: ${m.name} (${m.from}. günden ${m.to}. güne)`),
    ...diff.evening.map((e) => `${e.day}. gün akşam: ${e.to ?? "mekân yok"}${e.from ? ` (önce ${e.from})` : ""}`),
  ];
  return (
    <div className="rounded-sm border border-rule p-3">
      <Caption as="p">SON DEĞİŞİKLİK</Caption>
      <p className="mt-1 whitespace-pre-line text-caption text-ink">{change.reply}</p>
      {lines.length ? (
        <ul className="mt-2 grid gap-0.5 text-caption text-ink-muted">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-caption text-ink-muted">Duraklar aynı kaldı.</p>
      )}
      {canUndo ? (
        <Button className="mt-3" variant="ghost" onClick={onUndo}>
          <Undo2 aria-hidden="true" size={16} strokeWidth={1.5} />
          Geri al
        </Button>
      ) : null}
    </div>
  );
}

