import type { I18n } from "@/i18n/i18n";
import { formatMoney } from "@/lib/format";
import type { RateSourceId, RateTable } from "@/lib/rates/types";
import { convertAmount, type BudgetCurrency } from "./currency";
import { perPersonWhole, roundToWhole } from "./money";

/** The flight row's input: a chosen ticket, or why there is none. */
export type FlightLine =
  | {
      kind: "ticket";
      /** "Lufthansa · LH 1301 · IST → BCN" */
      label: string;
      pricePerAdult: number;
      differentDates: boolean;
      sample: boolean;
      /** Shown under the row, e.g. that the chosen ticket left the cache and the cheapest is used. */
      note: string | null;
    }
  | {
      kind: "web";
      /** The site the price came from, e.g. "example.com". */
      host: string;
      /** Kuruş per adult. */
      perAdult: number;
    }
  | { kind: "missing"; reason: string };

export type ReceiptInput = {
  flight: FlightLine;
  /** Minor units of `amountCur`; null when not entered. */
  stay: number | null;
  daily: number | null;
  /** Currency of `stay` and `daily` (`?cur=`): normally `cur`; another one until they can be converted. */
  amountCur: string;
  /** The currency the receipt is shown in. */
  cur: BudgetCurrency;
  /** TRY per unit; needed for every currency other than TRY. */
  rates: RateTable;
  nights: number;
  days: number;
  pax: number;
};

export type ReceiptRow = {
  id: "flight" | "stay" | "daily";
  label: string;
  /** "4 gece × 120 EUR", in the currency the amount came in. */
  detail: string | null;
  /** Whole units of `cur`, in minor units; null when the row is missing. */
  amount: number | null;
  /** Shown instead of an amount when the row is missing. */
  missing: string | null;
  /** Mono source captions under the row. */
  captions: string[];
  note?: string | null;
};

/** A rate the receipt converted with, for the source line under it. */
export type UsedRate = { currency: string; sourceId: RateSourceId; sourceName: string; date: string };

export type Receipt = {
  rows: ReceiptRow[];
  /** The currency of every amount below. */
  cur: BudgetCurrency;
  /** Sum of the rows that have amounts (each already in whole units). */
  total: number;
  /** True when at least one row is missing: the total is partial. */
  partial: boolean;
  perPerson: number;
  pax: number;
  /** The rates behind the converted rows (none when nothing was converted). */
  rates: UsedRate[];
};

/**
 * The budget receipt (PRD 13, 15). Flight × passengers, nights × the nightly
 * price the user entered, days × people × the daily spend the user entered.
 * Nothing is filled in for the user: a row without a value is missing, and the
 * total says it is partial. Every row is in whole units of the chosen currency,
 * so the rows add up to the total exactly. Flight prices come in TRY and are
 * converted only here, for display; every conversion goes through TRY. The texts are in the interface language.
 */
export function buildReceipt(input: ReceiptInput, { locale, m, f }: Pick<I18n, "locale" | "m" | "f">): Receipt {
  const t = m.budget;
  const money = (minor: number, currency: string) => formatMoney(minor, currency, locale);
  const used = new Map<string, UsedRate>();
  /** Minor units of `from` → minor units of `cur`, or null without a rate (never a guessed one). */
  const convert = (minor: number, from: string): number | null => {
    const converted = convertAmount(minor, from, input.cur, input.rates);
    if (converted === null || from === input.cur) return converted;
    for (const code of [from, input.cur]) {
      const rate = input.rates[code];
      if (rate) used.set(code, { currency: code, ...rate });
    }
    return converted;
  };
  const whole = (minor: number, from: string) => {
    const converted = convert(minor, from);
    return converted === null ? null : roundToWhole(converted);
  };

  const flightRow = (): ReceiptRow => {
    const { flight, pax } = input;
    if (flight.kind === "missing") {
      return { id: "flight", label: t.rows.flight, detail: null, amount: null, missing: t.missing.flight, captions: [flight.reason] };
    }
    const perAdult = flight.kind === "ticket" ? Math.round(flight.pricePerAdult * 100) : flight.perAdult;
    const amount = whole(perAdult * pax, "TRY");
    const detail = f(t.detail.flight, {
      pax,
      price: money(perAdult, "TRY"),
      label: flight.kind === "ticket" ? flight.label : f(t.detail.web, { host: flight.host }),
    });
    const noRate = amount === null ? [f(t.captions.noRate, { currency: input.cur })] : [];
    return flight.kind === "ticket"
      ? {
          id: "flight",
          label: t.rows.flight,
          detail,
          amount,
          missing: amount === null ? t.missing.rate : null,
          captions: [
            t.captions.cached,
            ...(flight.differentDates ? [t.captions.differentDate] : []),
            ...(flight.sample ? [t.captions.sample] : []),
            ...noRate,
          ],
          note: flight.note,
        }
      : {
          id: "flight",
          label: t.rows.flight,
          detail,
          amount,
          missing: amount === null ? t.missing.rate : null,
          captions: [t.captions.web, t.captions.verify, ...noRate],
          note: null,
        };
  };

  const enteredRow = (id: "stay" | "daily", minor: number | null, count: number, countText: string): ReceiptRow => {
    const label = t.rows[id];
    if (minor === null) return { id, label, detail: null, amount: null, missing: t.missing.entered, captions: [] };
    const from = input.amountCur;
    const detail = `${countText} × ${money(minor, from)}${from === input.cur ? "" : ` = ${money(minor * count, from)}`}`;
    const amount = whole(minor * count, from);
    if (amount === null) {
      return {
        id,
        label,
        detail,
        amount: null,
        missing: t.missing.rate,
        captions: [t.captions.entered, f(t.captions.noRate, { currency: from })],
      };
    }
    return { id, label, detail, amount, missing: null, captions: [t.captions.entered] };
  };

  const rows = [
    flightRow(),
    enteredRow("stay", input.stay, input.nights, f(t.detail.nights, { count: input.nights })),
    enteredRow("daily", input.daily, input.days * input.pax, f(t.detail.daysPeople, { days: input.days, pax: input.pax })),
  ];
  const total = rows.reduce((sum, row) => sum + (row.amount ?? 0), 0);
  return {
    rows,
    cur: input.cur,
    total,
    partial: rows.some((row) => row.amount === null),
    perPerson: perPersonWhole(total, input.pax),
    pax: input.pax,
    rates: [...used.values()],
  };
}
