/** Why live prices could not be shown. Each has its own plain message. */
export type FlightsErrorReason = "no-token" | "unauthorized" | "rate-limited" | "server" | "timeout" | "unavailable" | "same-city";

export const FLIGHTS_ERROR_MESSAGES: Record<FlightsErrorReason, string> = {
  "no-token": "Tahmini fiyatlar için Travelpayouts bağlantısı henüz kurulmadı.",
  unauthorized: "Travelpayouts erişim anahtarını kabul etmedi (401), bu yüzden fiyat alınamadı.",
  "rate-limited": "Travelpayouts kısa sürede çok fazla istek aldı (429). Birkaç dakika sonra yeniden dene.",
  server: "Travelpayouts şu an hata veriyor (sunucu hatası). Biraz sonra yeniden dene.",
  timeout: "Travelpayouts 4 saniye içinde cevap vermedi.",
  unavailable: "Travelpayouts'tan okunabilir bir cevap alınamadı.",
  // Not an error of the API: nothing is asked (src/lib/flights/search.ts `isSameCity`).
  "same-city": "Kalkış ve varış aynı şehir.",
};

/** HTTP status → reason; null for statuses that are not errors. */
export function reasonForStatus(status: number): FlightsErrorReason | null {
  if (status >= 200 && status < 300) return null;
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 429) return "rate-limited";
  if (status >= 500) return "server";
  return "unavailable";
}
