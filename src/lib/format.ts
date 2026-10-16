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
