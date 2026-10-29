const TIME_ZONE = "Europe/Istanbul";

const dayFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  weekday: "short",
  timeZone: TIME_ZONE,
});

const timeFormatter = new Intl.DateTimeFormat("tr-TR", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: TIME_ZONE,
});

const tryFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

/** "14 Kas Cmt" — day, short month, short weekday. */
export function formatDay(date: Date): string {
  const parts = dayFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("weekday")}`;
}

/** "08:45" — always 24-hour. */
export function formatTime(date: Date): string {
  return timeFormatter.format(date);
}

/** "12.450 ₺" — whole lira, Turkish grouping, symbol after the amount. */
export function formatTRY(amount: number): string {
  const parts = tryFormatter.formatToParts(amount);
  const number = parts
    .filter((p) => p.type !== "currency" && p.type !== "literal")
    .map((p) => p.value)
    .join("");
  return `${number} ₺`;
}

const moneyFormatters = new Map<string, Intl.NumberFormat>();
function moneyFormatter(currency: string, fraction: 0 | 2): Intl.NumberFormat {
  const key = `${currency}:${fraction}`;
  let formatter = moneyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      minimumFractionDigits: fraction,
      maximumFractionDigits: fraction,
    });
    moneyFormatters.set(key, formatter);
  }
  return formatter;
}

/**
 * Minor units in a currency, with cents only when there are any. Intl (`tr-TR`) gives the grouping, the
 * decimal comma, the symbol and where it sits ("€1.240", "$1.240,50", "£300"); lira keeps the site's
 * "12.450 ₺" (DESIGN.md), the symbol after the amount.
 */
export function formatMoney(minor: number, currency: string): string {
  const fraction = minor % 100 === 0 ? 0 : 2;
  const formatter = moneyFormatter(currency, fraction);
  if (currency !== "TRY") return formatter.format(minor / 100);
  const number = formatter
    .formatToParts(minor / 100)
    .filter((p) => p.type !== "currency" && p.type !== "literal")
    .map((p) => p.value)
    .join("");
  return `${number} ₺`;
}
