"use client";

import { useEffect, useId, useState } from "react";
import { Caption, Chip } from "@/components/ui";
import { cn } from "@/lib/cn";
import { amountToInput, formatMinor, parseAmountInput } from "@/lib/budget/money";
import { BUDGET_FLIGHT_DROPPED_EVENT, BUDGET_STAY_EVENT, writeBudgetParams, type BudgetParams } from "@/lib/budget/params";
import { buildReceipt, type FlightLine, type RateInfo, type ReceiptRow } from "@/lib/budget/receipt";

type Props = {
  initial: BudgetParams;
  flight: FlightLine;
  rate: RateInfo | null;
  localCurrency: string;
  nights: number;
  days: number;
  pax: number;
};

/** Keeps the shareable link in step with the inputs, without a server round trip. */
function writeUrl(budget: Partial<BudgetParams>) {
  const params = writeBudgetParams(new URLSearchParams(window.location.search), budget);
  window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}${window.location.hash}`);
}

function AmountField({
  label,
  hint,
  currency,
  value,
  error,
  onChange,
}: {
  label: string;
  hint: string;
  currency: string;
  value: string;
  error: string | null;
  onChange: (text: string) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-caption font-medium">
        {label}
      </label>
      <div
        className={cn(
          "mt-1.5 flex h-11 items-center gap-2 rounded-sm border bg-paper-raised px-3 focus-within:border-ink",
          error ? "border-warn" : "border-rule",
        )}
      >
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
          // w-full: an input's default width (about 20 characters) would otherwise set the column's minimum.
          className="h-full w-full min-w-0 flex-1 bg-transparent font-mono text-body tabular text-ink outline-none"
        />
        <span className="font-mono text-caption text-ink-muted">{currency === "TRY" ? "₺" : currency}</span>
      </div>
      <p id={`${id}-hint`} className="mt-1 text-caption text-ink-muted">
        {hint}
      </p>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-caption text-warn">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Row({ row }: { row: ReceiptRow }) {
  return (
    <div className="py-3">
      <div className="flex items-baseline gap-2">
        {/* The label may wrap; the amount never does, so a narrow screen never scrolls sideways. */}
        <dt className="min-w-0 text-body">{row.label}</dt>
        <span aria-hidden="true" className="min-w-4 flex-1 translate-y-[-0.3em] border-b border-dotted border-ink-muted" />
        <dd className={cn("shrink-0 font-mono text-body tabular", row.amount === null && "text-ink-muted")}>
          {row.amount === null ? row.missing : formatMinor(row.amount, "TRY")}
        </dd>
      </div>
      {row.detail ? <p className="mt-1 font-mono text-caption tabular text-ink-muted">{row.detail}</p> : null}
      {row.captions.map((caption) => (
        <Caption key={caption} as="p" className="mt-1">
          {caption}
        </Caption>
      ))}
      {row.note ? <p className="mt-1 text-caption text-ink-muted">{row.note}</p> : null}
    </div>
  );
}

/** DESIGN.md "Budget receipt": dotted leaders, a mono source under each line, a double rule above the total. */
export function BudgetReceipt({ initial, flight, rate, localCurrency, nights, days, pax }: Props) {
  const [cur, setCur] = useState(initial.cur);
  const [stayText, setStayText] = useState(initial.stay ? amountToInput(initial.stay) : "");
  const [dailyText, setDailyText] = useState(initial.daily ? amountToInput(initial.daily) : "");

  // The stay card's "Bütçeye yaz" (web search) fills the nightly field; it has already updated the URL.
  useEffect(() => {
    const onStay = (event: Event) => {
      const minor = (event as CustomEvent<{ minor?: unknown }>).detail?.minor;
      if (typeof minor === "number" && Number.isInteger(minor) && minor > 0) setStayText(amountToInput(minor));
    };
    window.addEventListener(BUDGET_STAY_EVENT, onStay);
    return () => window.removeEventListener(BUDGET_STAY_EVENT, onStay);
  }, []);

  // A new origin took the chosen flight out (the link no longer has it); said once, until another flight is chosen.
  const [flightDropped, setFlightDropped] = useState(false);
  useEffect(() => {
    const onDropped = () => setFlightDropped(true);
    window.addEventListener(BUDGET_FLIGHT_DROPPED_EVENT, onDropped);
    return () => window.removeEventListener(BUDGET_FLIGHT_DROPPED_EVENT, onDropped);
  }, []);
  const showDropped = flightDropped && initial.flight === null && initial.webFlight === null;

  const read = (text: string) => (text.trim() ? parseAmountInput(text) : null);
  const stay = read(stayText);
  const daily = read(dailyText);
  const receipt = buildReceipt({
    flight,
    stay: stay?.ok ? stay.minor : null,
    daily: daily?.ok ? daily.minor : null,
    cur,
    rate,
    nights,
    days,
    pax,
  });

  const onAmount = (key: "stay" | "daily", set: (t: string) => void) => (text: string) => {
    set(text);
    const parsed = read(text);
    // The link always matches the receipt: a valid amount is written, an empty or invalid box removes it.
    writeUrl({ [key]: parsed?.ok ? parsed.minor : null });
  };
  const currencies = localCurrency === "TRY" ? ["TRY"] : ["TRY", localCurrency];

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:items-start print:block">
      {/* Printed: only the total (the inputs and rows stay on screen). */}
      <div className="grid gap-5 print:hidden">
        {currencies.length > 1 ? (
          <div>
            <p id="butce-para-birimi" className="text-caption font-medium">
              Tutarları hangi para biriminde gireceksin?
            </p>
            <div role="group" aria-labelledby="butce-para-birimi" className="mt-1.5 flex gap-2">
              {currencies.map((code) => (
                <Chip
                  key={code}
                  selected={cur === code}
                  onClick={() => {
                    setCur(code);
                    writeUrl({ cur: code });
                  }}
                >
                  {code === "TRY" ? "TL (₺)" : code}
                </Chip>
              ))}
            </div>
            {cur !== "TRY" && rate && !rate.ok ? (
              <p className="mt-2 text-caption text-warn">{rate.currency} kuru şu an alınamıyor; bu tutarlar toplama eklenemez.</p>
            ) : null}
          </div>
        ) : null}
        <AmountField
          label="Gecelik konaklama (tüm odalar)"
          hint={`${nights} gece ile çarpılır. Otel fiyatını Booking ya da Google Hotels'te görüp buraya yazabilirsin.`}
          currency={cur}
          value={stayText}
          error={stay && !stay.ok ? stay.error : null}
          onChange={onAmount("stay", setStayText)}
        />
        <AmountField
          label="Kişi başı günlük harcama"
          hint={`${days} gün × ${pax} kişi ile çarpılır: yemek, ulaşım, müze…`}
          currency={cur}
          value={dailyText}
          error={daily && !daily.ok ? daily.error : null}
          onChange={onAmount("daily", setDailyText)}
        />
      </div>

      <section aria-label="Bütçe fişi" className="rounded-md border border-rule bg-paper-raised px-5 py-4 shadow-ticket md:px-8 md:py-6">
        <Caption as="p">BÜTÇE FİŞİ · TL</Caption>
        <p role="status" className="text-caption text-ink-muted empty:hidden print:hidden">
          {showDropped ? "Kalkış değişti; seçili uçuş bütçeden çıkarıldı." : ""}
        </p>
        <dl className="mt-2 divide-y divide-dashed divide-rule print:hidden">
          {receipt.rows.map((row) => (
            <Row key={row.id} row={row} />
          ))}
        </dl>
        <div className="mt-2 border-t-[3px] border-double border-ink pt-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-display text-heading">Toplam</span>
              {receipt.partial ? <Caption tone="warn">KISMİ TOPLAM</Caption> : null}
            </p>
            <p className="font-mono text-title tabular" aria-live="polite">
              {formatMinor(receipt.total, "TRY")}
            </p>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-4">
            <p className="text-body text-ink-muted">Kişi başı ({pax} kişi)</p>
            <p className="font-mono text-body tabular">{formatMinor(receipt.perPerson, "TRY")}</p>
          </div>
          {receipt.partial ? (
            <p className="mt-3 text-caption text-ink-muted">Değeri olmayan satırlar toplama eklenmedi.</p>
          ) : null}
          {receipt.rate?.sourceId === "erapi" ? (
            // Attribution required by the open access terms of exchangerate-api.com.
            <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-caption underline">
              Rates By Exchange Rate API
            </a>
          ) : null}
        </div>
      </section>
    </div>
  );
}
