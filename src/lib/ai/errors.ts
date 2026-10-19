import type { ProviderId } from "./providers";

export type AiErrorKind = "auth" | "quota" | "rate" | "model" | "network" | "timeout" | "server" | "refusal" | "invalid";

/** Calm, Turkish, and says what to do next. Never echoes the key or the provider's raw text. */
export const AI_ERROR_MESSAGES: Record<AiErrorKind, string> = {
  auth: "Anahtar geçersiz ya da bu sağlayıcıya ait değil. Anahtarı kontrol edip yeniden bağlan.",
  quota: "Hesabındaki kota ya da kredi bitmiş görünüyor. Sağlayıcının panelinden kontrol edebilirsin.",
  rate: "Sağlayıcı şu an çok fazla istek aldığını söylüyor. Biraz bekleyip yeniden dene.",
  model: "Seçilen model bu anahtarla kullanılamıyor. Listeden başka bir model seç.",
  network: "Sağlayıcıya ulaşılamadı. İnternet bağlantını kontrol edip yeniden dene.",
  timeout: "Sağlayıcı zamanında cevap vermedi. Yeniden dene ya da daha hızlı bir model seç.",
  server: "Sağlayıcı tarafında geçici bir sorun var. Biraz sonra yeniden dene.",
  refusal: "Model bu isteği yanıtlamadı. İsteği farklı sözcüklerle yeniden dene.",
  invalid: "Modelin cevabı kurallarımıza uymadı; plan değişmedi.",
};

export class AiError extends Error {
  constructor(readonly kind: AiErrorKind) {
    super(AI_ERROR_MESSAGES[kind]);
    this.name = "AiError";
  }
}

/** Maps an HTTP error to a kind, from the status and the provider's error code (never its message text). */
export async function aiErrorFromResponse(provider: ProviderId, res: Response): Promise<AiError> {
  let body: { error?: { type?: string; code?: string | number; status?: string; details?: Array<{ reason?: string }> } } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    // Not JSON: decide from the status alone.
  }
  const code = String(body.error?.code ?? "");
  const type = body.error?.type ?? "";
  const reasons = (body.error?.details ?? []).map((d) => d.reason ?? "");
  if (res.status === 401 || res.status === 403 || type === "authentication_error" || reasons.includes("API_KEY_INVALID")) {
    return new AiError("auth");
  }
  if (res.status === 402 || code === "insufficient_quota" || type === "billing_error") return new AiError("quota");
  if (res.status === 429) return new AiError(provider === "gemini" && body.error?.status === "RESOURCE_EXHAUSTED" ? "quota" : "rate");
  if (res.status === 404 || code === "model_not_found" || type === "not_found_error") return new AiError("model");
  if (res.status >= 500) return new AiError("server");
  return new AiError("invalid");
}

export function aiErrorFromThrown(error: unknown): AiError {
  if (error instanceof AiError) return error;
  if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) return new AiError("timeout");
  return new AiError("network");
}
