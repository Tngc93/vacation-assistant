import type { I18n } from "@/i18n/i18n";
import type { ProviderId } from "./providers";

export type AiErrorKind =
  | "auth"
  | "quota"
  | "freeTier"
  | "quotaUnknown"
  | "rate"
  | "model"
  | "network"
  | "timeout"
  | "overloaded"
  | "server"
  | "refusal"
  | "request"
  | "invalid";

/** What the caption under an error may show: the HTTP status and the model name, nothing else. */
export type AiErrorDetail = { status?: number; model?: string; retryAfterMs?: number };

/**
 * The calm message, in the interface language (messages `ai.errors`), that says what to do next. Never echoes the
 * key or the provider's raw text.
 */
export function aiErrorText(error: unknown, { m, f }: Pick<I18n, "m" | "f">): string {
  const e = error instanceof AiError ? error : new AiError("network");
  if (e.kind === "rate" && e.retryAfterMs !== undefined) {
    const seconds = Math.max(1, Math.ceil(e.retryAfterMs / 1000));
    const wait = seconds < 120 ? f(m.ai.waitSeconds, { count: seconds }) : f(m.ai.waitMinutes, { count: Math.ceil(seconds / 60) });
    return f(m.ai.rateWait, { wait });
  }
  return m.ai.errors[e.kind];
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
    // The kind only: the interface words it in its language (aiErrorText).
    super(`AI error: ${kind}`);
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

/**
 * "HTTP 503 · GEMINI-3.5-FLASH": the honest diagnosis under an error message. Never the key, body or raw text.
 * Upper-cased here without a locale: the caption's CSS uppercase would follow the page's Turkish rules
 * ("GEMİNİ"), and upper-case text stays as it is.
 */
export function aiErrorCaption(error: unknown): string | null {
  if (!(error instanceof AiError)) return null;
  const parts = [error.status ? `HTTP ${error.status}` : null, error.model ?? null].filter((p): p is string => !!p);
  return parts.length ? parts.join(" · ").toUpperCase() : null;
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
  // Neither which quota nor how long to wait (seen with Gemini 3 web search on the free tier, 2026-10-21).
  if (!violations.length && retryAfterMs === undefined) return { kind: "quotaUnknown" };
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
      return new AiError(limit.kind, { status, retryAfterMs: limit.kind === "rate" ? (limit.retryAfterMs ?? headerDelay) : undefined });
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
