"use client";

import { useEffect, useId, useState } from "react";
import { Caption } from "@/components/ui";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { convertAmount, currencyLabel, effectiveCurrency, parseBudgetCurrency } from "@/lib/budget/currency";
import { amountToInput, parseAmountInput } from "@/lib/budget/money";
import { BUDGET_FLIGHT_DROPPED_EVENT, BUDGET_STAY_EVENT, writeBudgetParams, type BudgetParams } from "@/lib/budget/params";
import { buildReceipt, type FlightLine, type ReceiptRow } from "@/lib/budget/receipt";
import { formatRateSources } from "@/lib/rates/format";
import { SOURCES, type RateTable } from "@/lib/rates/types";
import { pickedOnThisPage, useBudgetCurrency } from "./useBudgetCurrency";

type Props = {
  initial: BudgetParams;
  flight: FlightLine;
  /** TRY per unit for the budget's currencies (and the destination's, for older `?cur=` links). */
  rates: RateTable;
  nights: number;
  days: number;
  pax: number;
};

/** What was typed (or came in the link), in the currency it was typed in: conversions start from it, so no drift. */
type Entered = { minor: number; currency: string } | null;

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
          "mt-1.5 flex h-11 items-center gap-2 rounded-sm border bg-paper-raised px-3 focus-within:border-ink field-focus-ring",
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

function Row({ row, currency }: { row: ReceiptRow; currency: string }) {
  const { locale } = useI18n();
  const hasNotes = Boolean(row.detail || row.captions.length || row.note);
  // A <dl> group holds only <dt> and <dd>: the dotted leader lives in the term, the notes in a second <dd>.
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 py-3">
      <dt className="flex min-w-0 items-baseline gap-2 text-body">
        {/* The label may wrap; the amount never does, so a narrow screen never scrolls sideways. */}
        <span className="min-w-0">{row.label}</span>
        <span aria-hidden="true" className="min-w-4 flex-1 translate-y-[-0.3em] border-b border-dotted border-ink-muted" />
      </dt>
      <dd className={cn("shrink-0 font-mono text-body tabular", row.amount === null && "text-ink-muted")}>
        {row.amount === null ? row.missing : formatMoney(row.amount, currency, locale)}
      </dd>
      {hasNotes ? (
        <dd className="col-span-2">
          {row.detail ? <p className="mt-1 font-mono text-caption tabular text-ink-muted">{row.detail}</p> : null}
          {row.captions.map((caption) => (
            <Caption key={caption} as="p" className="mt-1">
              {caption}
            </Caption>
          ))}
          {row.note ? <p className="mt-1 text-caption text-ink-muted">{row.note}</p> : null}
        </dd>
      ) : null}
    </div>
  );
}

/** DESIGN.md "Budget receipt": dotted leaders, a mono source under each line, a double rule above the total. */
export function BudgetReceipt({ initial, flight, rates, nights, days, pax }: Props) {
  const i18n = useI18n();
  const { locale, m, f } = i18n;
  const toInput = (minor: number) => amountToInput(minor, locale);
  const chosen = useBudgetCurrency(parseBudgetCurrency(initial.cur));
  // Without the chosen currency's rate the budget stays in TRY and says so.
  const cur = effectiveCurrency(chosen, rates);
  // The currency of the two fields and of `?stay=`/`?daily=` (always the link's `?cur=`); `cur` once converted.
  const [amountCur, setAmountCur] = useState(initial.cur);
  const [stayText, setStayText] = useState(initial.stay ? toInput(initial.stay) : "");
  const [dailyText, setDailyText] = useState(initial.daily ? toInput(initial.daily) : "");
  const [entered, setEntered] = useState<{ stay: Entered; daily: Entered }>({
    stay: initial.stay ? { minor: initial.stay, currency: initial.cur } : null,
    daily: initial.daily ? { minor: initial.daily, currency: initial.cur } : null,
  });

  // Another currency chosen (or remembered, or an older link's TRY/local amounts): convert what was entered,
  // during render like any state that follows a prop. Without a rate the amounts stay as they are, and their
  // rows say so.
  if (amountCur !== cur) {
    const convert = (e: Entered) => (e ? convertAmount(e.minor, e.currency, cur, rates) : null);
    const stay = convert(entered.stay);
    const daily = convert(entered.daily);
    if (!(entered.stay && stay === null) && !(entered.daily && daily === null)) {
      if (stay !== null) setStayText(toInput(stay));
      if (daily !== null) setDailyText(toInput(daily));
      setAmountCur(cur);
    }
  }

  // The link names the amounts' currency: once they are converted, both are written together. A language's
  // default (TRY, EUR in English) is not written on its own: `?cur=` goes in when the picker was used, or when there
  // are amounts the link must label.
  useEffect(() => {
    const linked = new URLSearchParams(window.location.search).get("cur")?.toUpperCase() || "TRY";
    if (linked === amountCur) return;
    const valid = (text: string) => {
      const parsed = text.trim() ? parseAmountInput(text) : null;
      return parsed?.ok ? parsed.minor : null;
    };
    const stay = valid(stayText);
    const daily = valid(dailyText);
    if (stay === null && daily === null && !pickedOnThisPage()) return;
    writeUrl({ stay, daily, cur: amountCur });
  }, [amountCur, stayText, dailyText]);

  // The stay card's "Bütçeye yaz" (web search) fills the nightly field, in the field's currency.
  useEffect(() => {
    const onStay = (event: Event) => {
      const detail = (event as CustomEvent<{ minor?: unknown; currency?: unknown }>).detail;
      const minor = detail?.minor;
      const currency = typeof detail?.currency === "string" ? detail.currency : null;
      if (typeof minor !== "number" || !Number.isInteger(minor) || minor <= 0 || !currency) return;
      const inField = convertAmount(minor, currency, amountCur, rates);
      if (inField === null) return;
      event.preventDefault();
      setEntered((e) => ({ ...e, stay: { minor, currency } }));
      setStayText(amountToInput(inField, locale));
      writeUrl({ stay: inField });
    };
    window.addEventListener(BUDGET_STAY_EVENT, onStay);
    return () => window.removeEventListener(BUDGET_STAY_EVENT, onStay);
  }, [amountCur, rates, locale]);

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
  const receipt = buildReceipt(
    {
      flight,
      stay: stay?.ok ? stay.minor : null,
      daily: daily?.ok ? daily.minor : null,
      amountCur,
      cur,
      rates,
      nights,
      days,
      pax,
    },
    i18n,
  );

  const onAmount = (key: "stay" | "daily", set: (t: string) => void) => (text: string) => {
    set(text);
    const parsed = read(text);
    const minor = parsed?.ok ? parsed.minor : null;
    setEntered((e) => ({ ...e, [key]: minor === null ? null : { minor, currency: amountCur } }));
    // The link always matches the receipt: a valid amount is written, an empty or invalid box removes it.
    writeUrl({ [key]: minor });
  };

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:items-start print:block">
      {/* Printed: only the total (the inputs and rows stay on screen). */}
      <div className="grid gap-5 print:hidden">
        <AmountField
          label={m.budget.stayLabel}
          hint={f(m.budget.stayHint, { nights })}
          currency={amountCur}
          value={stayText}
          error={stay && !stay.ok ? m.budget.amountErrors[stay.error] : null}
          onChange={onAmount("stay", setStayText)}
        />
        <AmountField
          label={m.budget.dailyLabel}
          hint={f(m.budget.dailyHint, { days, pax })}
          currency={amountCur}
          value={dailyText}
          error={daily && !daily.ok ? m.budget.amountErrors[daily.error] : null}
          onChange={onAmount("daily", setDailyText)}
        />
      </div>

      <section aria-label={m.budget.receipt} className="rounded-md border border-rule bg-paper-raised px-5 py-4 shadow-ticket md:px-8 md:py-6">
        <Caption as="p">{f(m.budget.heading, { currency: currencyLabel(receipt.cur, locale) })}</Caption>
        {chosen !== cur ? <p className="mt-1 text-caption text-warn">{f(m.budget.noRate, { currency: chosen })}</p> : null}
        <p role="status" className="text-caption text-ink-muted empty:hidden print:hidden">
          {showDropped ? m.budget.flightDropped : ""}
        </p>
        <dl className="mt-2 divide-y divide-dashed divide-rule print:hidden">
          {receipt.rows.map((row) => (
            <Row key={row.id} row={row} currency={receipt.cur} />
          ))}
        </dl>
        <div className="mt-2 border-t-[3px] border-double border-ink pt-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-display text-heading">{m.budget.total}</span>
              {receipt.partial ? <Caption tone="warn">{m.budget.partial}</Caption> : null}
            </p>
            <p className="font-mono text-title tabular" aria-live="polite">
              {formatMoney(receipt.total, receipt.cur, locale)}
            </p>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-4">
            <p className="text-body text-ink-muted">{f(m.budget.perPerson, { count: pax })}</p>
            <p className="font-mono text-body tabular">{formatMoney(receipt.perPerson, receipt.cur, locale)}</p>
          </div>
          {receipt.partial ? <p className="mt-3 text-caption text-ink-muted">{m.budget.partialNote}</p> : null}
          {receipt.rates.length ? (
            <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 font-mono text-caption tabular text-ink-muted">
              <span>{formatRateSources(receipt.rates, i18n)}</span>
              {receipt.rates.some((r) => r.sourceId === "erapi") ? (
                // Attribution required by the open access terms of exchangerate-api.com.
                <a href={SOURCES.erapi.url} target="_blank" rel="noopener noreferrer" className="underline">
                  Rates By Exchange Rate API
                </a>
              ) : null}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
