import type { ProviderId } from "./providers";

export type AiErrorKind =
  | "auth"
  | "quota"
  | "freeTier"
  | "rate"
  | "model"
  | "network"
  | "timeout"
  | "overloaded"
  | "server"
  | "refusal"
  | "request"
  | "invalid";

/** Calm, Turkish, and says what to do next. Never echoes the key or the provider's raw text. */
export const AI_ERROR_MESSAGES: Record<AiErrorKind, string> = {
  auth: "Anahtar geçersiz ya da bu sağlayıcıya ait değil. Anahtarı kontrol edip yeniden bağlan.",
  quota: "Hesabındaki kota ya da kredi bitmiş görünüyor. Sağlayıcının panelinden kontrol edebilirsin.",
  freeTier: "Bu model ücretsiz katmanda kullanılamıyor. Bağlantı ayarları'ndan başka bir model seç.",
  rate: "Sağlayıcı şu an çok fazla istek aldığını söylüyor. Biraz bekleyip yeniden dene.",
  model: "Seçilen model bu anahtarla kullanılamıyor. Listeden başka bir model seç.",
  network: "Sağlayıcıya ulaşılamadı. İnternet bağlantını kontrol edip yeniden dene.",
  timeout: "Sağlayıcı zamanında cevap vermedi. Yeniden dene ya da daha hızlı bir model seç.",
  overloaded: "Bu model şu an çok yoğun. Biraz sonra yeniden dene ya da Bağlantı ayarları'ndan başka bir model seç.",
  server: "Sağlayıcı tarafında geçici bir sorun var. Biraz sonra yeniden dene.",
  refusal: "Model bu isteği yanıtlamadı. İsteği farklı sözcüklerle yeniden dene.",
  /** HTTP 400 and other 4xx the provider gives no better reason for. */
  request: "Sağlayıcı bu isteği kabul etmedi. Bağlantı ayarları'ndan başka bir model seçip yeniden dene.",
  /** Only for a model answer that fails our schema or rules (never an HTTP error). */
  invalid: "Modelin cevabı kurallarımıza uymadı; plan değişmedi.",
};

/** What the caption under an error may show: the HTTP status and the model name, nothing else. */
export type AiErrorDetail = { status?: number; model?: string; retryAfterMs?: number };

/** "yaklaşık 25 saniye", "yaklaşık 3 dakika" */
function waitText(ms: number): string {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  return seconds < 120 ? `yaklaşık ${seconds} saniye` : `yaklaşık ${Math.ceil(seconds / 60)} dakika`;
}

function messageFor(kind: AiErrorKind, detail: AiErrorDetail): string {
  if (kind === "rate" && detail.retryAfterMs !== undefined) {
    return `Sağlayıcı şu an çok fazla istek aldığını söylüyor. ${waitText(detail.retryAfterMs).replace(/^y/, "Y")} sonra yeniden dene.`;
  }
  return AI_ERROR_MESSAGES[kind];
}

export class AiError extends Error {
  readonly status?: number;
  readonly model?: string;
  /** How long the provider asked us to wait (Retry-After or Gemini's RetryInfo), when it said. */
  readonly retryAfterMs?: number;

  constructor(
    readonly kind: AiErrorKind,
    detail: AiErrorDetail = {},
  ) {
    super(messageFor(kind, detail));
    this.name = "AiError";
    this.status = detail.status;
    this.model = detail.model;
    this.retryAfterMs = detail.retryAfterMs;
  }

  /** The same error with the model named, for the caption. */
  withModel(model: string): AiError {
    return new AiError(this.kind, { status: this.status, model, retryAfterMs: this.retryAfterMs });
  }
}

/** "HTTP 503 · gemini-3.5-flash": the honest diagnosis under an error message. Never the key, body or raw text. */
export function aiErrorCaption(error: unknown): string | null {
  if (!(error instanceof AiError)) return null;
  const parts = [error.status ? `HTTP ${error.status}` : null, error.model ?? null].filter((p): p is string => !!p);
  return parts.length ? parts.join(" · ") : null;
}

type ErrorDetail = {
  "@type"?: string;
  reason?: string;
  retryDelay?: string;
  violations?: Array<{ quotaId?: string; quotaValue?: string | number; limit?: string | number }>;
};
type ErrorBody = { error?: { type?: string; code?: string | number; status?: string; details?: ErrorDetail[] } };

/** "25s", "4.5s" (google.protobuf.Duration in JSON) → milliseconds. */
function parseDuration(value: string | undefined): number | undefined {
  const m = /^(\d+(?:\.\d+)?)s$/.exec(value ?? "");
  return m ? Math.round(Number(m[1]) * 1000) : undefined;
}

/** Retry-After: seconds or an HTTP date. Only readable from the browser when the provider exposes it via CORS. */
function parseRetryAfter(value: string | null, now: number): number | undefined {
  if (!value) return undefined;
  if (/^\d+(\.\d+)?$/.test(value.trim())) return Math.round(Number(value) * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

/**
 * Gemini answers every 429 with RESOURCE_EXHAUSTED; the details say which limit. A per-day quota is "quota",
 * a limit of 0 means the model is not in the free tier, anything else (per minute) is a rate limit to wait out.
 */
function geminiRateLimit(details: ErrorDetail[]): { kind: AiErrorKind; retryAfterMs?: number } {
  const violations = details.filter((d) => d["@type"]?.endsWith("google.rpc.QuotaFailure")).flatMap((d) => d.violations ?? []);
  const retryAfterMs = parseDuration(details.find((d) => d["@type"]?.endsWith("google.rpc.RetryInfo"))?.retryDelay);
  const limit = (v: (typeof violations)[number]) => v.quotaValue ?? v.limit;
  if (violations.some((v) => limit(v) !== undefined && Number(limit(v)) === 0)) return { kind: "freeTier" };
  if (violations.some((v) => /PerDay/.test(v.quotaId ?? ""))) return { kind: "quota" };
  return { kind: "rate", retryAfterMs };
}

/** Maps an HTTP error to a kind, from the status and the provider's error code (never its message text). */
export async function aiErrorFromResponse(provider: ProviderId, res: Response, now = Date.now()): Promise<AiError> {
  let body: ErrorBody = {};
  try {
    body = (await res.json()) as ErrorBody;
  } catch {
    // Not JSON: decide from the status alone.
  }
  const status = res.status;
  const code = String(body.error?.code ?? "");
  const type = body.error?.type ?? "";
  const details = Array.isArray(body.error?.details) ? body.error.details : [];
  const reasons = details.map((d) => d.reason ?? "");
  if (status === 401 || status === 403 || type === "authentication_error" || reasons.includes("API_KEY_INVALID")) {
    return new AiError("auth", { status });
  }
  if (status === 402 || code === "insufficient_quota" || type === "billing_error") return new AiError("quota", { status });
  if (status === 429) {
    const headerDelay = parseRetryAfter(res.headers.get("retry-after"), now);
    if (provider === "gemini" && body.error?.status === "RESOURCE_EXHAUSTED") {
      const limit = geminiRateLimit(details);
      return new AiError(limit.kind, { status, retryAfterMs: limit.retryAfterMs ?? headerDelay });
    }
    return new AiError("rate", { status, retryAfterMs: headerDelay });
  }
  if (status === 404 || code === "model_not_found" || type === "not_found_error") return new AiError("model", { status });
  if (status === 503 || status === 529 || type === "overloaded_error") return new AiError("overloaded", { status });
  if (status >= 500) return new AiError("server", { status });
  return new AiError("request", { status });
}

export function aiErrorFromThrown(error: unknown): AiError {
  if (error instanceof AiError) return error;
  if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) return new AiError("timeout");
  return new AiError("network");
}
