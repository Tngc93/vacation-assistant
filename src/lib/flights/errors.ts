/** Why live prices could not be shown. Each has its own plain message. */
export type FlightsErrorReason = "no-token" | "unauthorized" | "rate-limited" | "server" | "timeout" | "unavailable" | "same-city";

/** Each reason's plain message is in the interface language: messages `flights.errors`. */

/** HTTP status → reason; null for statuses that are not errors. */
export function reasonForStatus(status: number): FlightsErrorReason | null {
  if (status >= 200 && status < 300) return null;
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 429) return "rate-limited";
  if (status >= 500) return "server";
  return "unavailable";
}
