import { formatDay } from "@/lib/format";
import { isoToDate } from "@/lib/search/dates";
import { formatMinor, perPersonLira, roundToLira, toKurus } from "./money";

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

/** A TRY rate for the destination currency (serialisable for client components). */
export type RateInfo =
  | { ok: true; currency: string; tryPerUnit: number; sourceId: string; sourceName: string; date: string }
  | { ok: false; currency: string };

export type ReceiptInput = {
  flight: FlightLine;
  /** Minor units of `cur`; null when not entered. */
  stay: number | null;
  daily: number | null;
  cur: string;
  /** Needed only when `cur` is not TRY. */
  rate: RateInfo | null;
  nights: number;
  days: number;
  pax: number;
};

export type ReceiptRow = {
  id: "flight" | "stay" | "daily";
  label: string;
  /** "4 gece × 120 EUR" */
  detail: string | null;
  /** Whole lira, in kuruş; null when the row is missing. */
  amount: number | null;
  /** Shown instead of an amount when the row is missing. */
  missing: string | null;
  /** Mono source captions under the row. */
  captions: string[];
  note?: string | null;
};

export type Receipt = {
  rows: ReceiptRow[];
  /** Sum of the rows that have amounts (each already whole lira). */
  total: number;
  /** True when at least one row is missing: the total is partial. */
  partial: boolean;
  perPerson: number;
  pax: number;
  /** Set when a local-currency row was converted: the rate used. */
  rate: Extract<RateInfo, { ok: true }> | null;
};

const ESTIMATE = "TAHMİNİ";
const ENTERED = `SENİN GİRDİĞİN · ${ESTIMATE}`;

/** "16 EKİ" */
export function rateDateCaption(date: string): string {
  const [day, month] = formatDay(isoToDate(date)).split(" ");
  return `${day} ${month.toLocaleUpperCase("tr")}`;
}

function enteredRow(
  id: "stay" | "daily",
  label: string,
  minor: number | null,
  count: number,
  countText: string,
  input: ReceiptInput,
): ReceiptRow {
  if (minor === null) return { id, label, detail: null, amount: null, missing: "girilmedi", captions: [] };
  const detail = `${countText} × ${formatMinor(minor, input.cur)}`;
  const localTotal = minor * count;
  if (input.cur === "TRY") return { id, label, detail, amount: roundToLira(localTotal), missing: null, captions: [ENTERED] };
  if (!input.rate?.ok) {
    return {
      id,
      label,
      detail: `${detail} = ${formatMinor(localTotal, input.cur)}`,
      amount: null,
      missing: "kur alınamadı",
      captions: [ENTERED, `${input.cur} KURU ALINAMADI · TOPLAMA EKLENMEDİ`],
    };
  }
  return {
    id,
    label,
    detail: `${detail} = ${formatMinor(localTotal, input.cur)}`,
    amount: roundToLira(toKurus(localTotal, input.rate.tryPerUnit)),
    missing: null,
    captions: [ENTERED, `KUR: ${input.rate.sourceName.toLocaleUpperCase("tr")} · ${rateDateCaption(input.rate.date)}`],
  };
}

/**
 * The budget receipt (PRD 13, 15). Flight × passengers, nights × the nightly
 * price the user entered, days × people × the daily spend the user entered.
 * Nothing is filled in for the user: a row without a value is missing, and the
 * total says it is partial. Every row is whole lira, so the rows add up to the
 * total exactly.
 */
export function buildReceipt(input: ReceiptInput): Receipt {
  const flight: ReceiptRow =
    input.flight.kind === "ticket"
      ? {
          id: "flight",
          label: "Uçuş",
          detail: `${input.pax} yolcu × ${formatMinor(Math.round(input.flight.pricePerAdult * 100), "TRY")} · ${input.flight.label}`,
          amount: roundToLira(Math.round(input.flight.pricePerAdult * 100) * input.pax),
          missing: null,
          captions: [
            ["TRAVELPAYOUTS · ÖNBELLEKTEN", ESTIMATE].join(" · "),
            ...(input.flight.differentDates ? ["FARKLI TARİH"] : []),
            ...(input.flight.sample ? ["ÖRNEK VERİ · GERÇEK FİYAT DEĞİL"] : []),
          ],
          note: input.flight.note,
        }
      : input.flight.kind === "web"
        ? {
            id: "flight",
            label: "Uçuş",
            detail: `${input.pax} yolcu × ${formatMinor(input.flight.perAdult, "TRY")} · web: ${input.flight.host}`,
            amount: roundToLira(input.flight.perAdult * input.pax),
            missing: null,
            captions: ["YAPAY ZEKÂ WEB'DEN BULDU · TAHMİNİ", "SATIN ALMADAN ÖNCE DOĞRULA"],
            note: null,
          }
        : { id: "flight", label: "Uçuş", detail: null, amount: null, missing: "uçuş fiyatı yok", captions: [input.flight.reason] };

  const rows = [
    flight,
    enteredRow("stay", "Konaklama", input.stay, input.nights, `${input.nights} gece`, input),
    enteredRow("daily", "Günlük harcama", input.daily, input.days * input.pax, `${input.days} gün × ${input.pax} kişi`, input),
  ];
  const total = rows.reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const usedRate = input.cur !== "TRY" && input.rate?.ok && rows.some((r) => r.id !== "flight" && r.amount !== null) ? input.rate : null;
  return {
    rows,
    total,
    partial: rows.some((row) => row.amount === null),
    perPerson: perPersonLira(total, input.pax),
    pax: input.pax,
    rate: usedRate,
  };
}
