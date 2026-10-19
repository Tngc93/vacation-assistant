/**
 * The user's own AI provider, called straight from the browser: the key never
 * reaches our server (PRD 23–24). One small fetch-based layer for all three
 * providers (no SDKs), each checked to answer CORS preflights from any site.
 * Model names are never hard-coded: they come from each provider's model list.
 */
import { timeoutSignal } from "@/lib/net";
import { AiError, aiErrorFromResponse, aiErrorFromThrown } from "./errors";
import { AI_ORIGINS } from "./origins";

export type ProviderId = keyof typeof AI_ORIGINS;

export type Provider = {
  id: ProviderId;
  label: string;
  /** API origin: the only place the key is sent (and the Content-Security-Policy's connect-src). */
  origin: string;
  /** Where to create a key. */
  keyPage: string;
  /** Has a free tier (Gemini, per ai.google.dev/gemini-api/docs/pricing, checked 2026-10-19). */
  freeTier: boolean;
};

export const PROVIDERS: Record<ProviderId, Provider> = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic (Claude)",
    origin: AI_ORIGINS.anthropic,
    keyPage: "https://platform.claude.com/settings/keys",
    freeTier: false,
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    origin: AI_ORIGINS.openai,
    keyPage: "https://platform.openai.com/api-keys",
    freeTier: false,
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    origin: AI_ORIGINS.gemini,
    keyPage: "https://aistudio.google.com/app/apikey",
    freeTier: true,
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];
export const PROVIDER_ORIGINS = PROVIDER_IDS.map((id) => PROVIDERS[id].origin);

export type ModelInfo = { id: string; label: string; created: number };
export type Connection = { provider: ProviderId; key: string; model: string };
export type ChatMessage = { role: "user" | "assistant"; text: string };
type Fetch = typeof fetch;

export const LIST_TIMEOUT_MS = 15_000;
export const COMPLETE_TIMEOUT_MS = 120_000;

/** Anthropic needs this header to accept a call made from a web page (checked against the official SDK). */
const anthropicHeaders = (key: string): Record<string, string> => ({
  "x-api-key": key,
  "anthropic-version": "2023-06-01",
  "anthropic-dangerous-direct-browser-access": "true",
});

async function call(provider: ProviderId, url: string, init: RequestInit, fetcher: Fetch, timeoutMs: number): Promise<unknown> {
  let res: Response;
  try {
    res = await fetcher(url, { ...init, signal: timeoutSignal(timeoutMs) });
  } catch (error) {
    throw aiErrorFromThrown(error);
  }
  if (!res.ok) throw await aiErrorFromResponse(provider, res);
  try {
    return await res.json();
  } catch {
    throw new AiError("server");
  }
}

/** Chat models the key can use, newest first. Doubles as the key check when connecting. */
export async function listModels(provider: ProviderId, key: string, fetcher: Fetch = fetch): Promise<ModelInfo[]> {
  const origin = PROVIDERS[provider].origin;
  if (provider === "anthropic") {
    const json = (await call(provider, `${origin}/v1/models?limit=100`, { headers: anthropicHeaders(key) }, fetcher, LIST_TIMEOUT_MS)) as {
      data?: Array<{ id: string; display_name?: string; created_at?: string }>;
    };
    return sortNewest(
      (json.data ?? []).map((m) => ({ id: m.id, label: m.display_name ?? m.id, created: Date.parse(m.created_at ?? "") || 0 })),
    );
  }
  if (provider === "openai") {
    const json = (await call(provider, `${origin}/v1/models`, { headers: { Authorization: `Bearer ${key}` } }, fetcher, LIST_TIMEOUT_MS)) as {
      data?: Array<{ id: string; created?: number }>;
    };
    return sortNewest(
      (json.data ?? [])
        .filter((m) => /^(gpt-|o\d|chatgpt-)/.test(m.id) && !/(audio|realtime|transcribe|tts|search|image|embedding|instruct|codex)/.test(m.id))
        .map((m) => ({ id: m.id, label: m.id, created: (m.created ?? 0) * 1000 })),
    );
  }
  const json = (await call(provider, `${origin}/v1beta/models?pageSize=200`, { headers: { "x-goog-api-key": key } }, fetcher, LIST_TIMEOUT_MS)) as {
    models?: Array<{ name: string; displayName?: string; supportedGenerationMethods?: string[] }>;
  };
  return (json.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent") && /gemini/.test(m.name))
    .filter((m) => !/(image|tts|embedding|live|audio)/.test(m.name))
    .map((m) => ({ id: m.name.replace(/^models\//, ""), label: m.displayName ?? m.name, created: 0 }))
    .sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
}

const sortNewest = (models: ModelInfo[]) =>
  [...models].sort((a, b) => b.created - a.created || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/**
 * A fast, inexpensive model to suggest, by family name rather than a fixed id: the newest Haiku, the newest
 * "mini" GPT, the newest stable Gemini Flash. The user can pick any other model.
 */
export function suggestModel(provider: ProviderId, models: readonly ModelInfo[]): string | null {
  const pick = (test: (id: string) => boolean) => models.find((m) => test(m.id))?.id;
  const choice =
    provider === "anthropic"
      ? pick((id) => /haiku/.test(id))
      : provider === "openai"
        ? pick((id) => /^gpt-.*-mini$/.test(id)) ?? pick((id) => /mini/.test(id))
        : pick((id) => /flash/.test(id) && !/(lite|preview|exp|thinking)/.test(id)) ?? pick((id) => /flash/.test(id));
  return choice ?? models[0]?.id ?? null;
}

/** One request to the model; returns its text. Throws AiError (Turkish message) on any failure. */
export async function complete(
  conn: Connection,
  request: { system: string; messages: readonly ChatMessage[]; json?: boolean },
  fetcher: Fetch = fetch,
): Promise<string> {
  const { provider, key, model } = conn;
  const origin = PROVIDERS[provider].origin;
  if (provider === "anthropic") {
    const json = (await call(
      provider,
      `${origin}/v1/messages`,
      {
        method: "POST",
        headers: { ...anthropicHeaders(key), "content-type": "application/json" },
        body: JSON.stringify({
          model,
          max_tokens: 16000,
          system: request.system,
          messages: request.messages.map((m) => ({ role: m.role, content: m.text })),
        }),
      },
      fetcher,
      COMPLETE_TIMEOUT_MS,
    )) as { content?: Array<{ type: string; text?: string }>; stop_reason?: string };
    if (json.stop_reason === "refusal") throw new AiError("refusal");
    return (json.content ?? []).flatMap((b) => (b.type === "text" && b.text ? [b.text] : [])).join("");
  }
  if (provider === "openai") {
    const json = (await call(
      provider,
      `${origin}/v1/chat/completions`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: request.system }, ...request.messages.map((m) => ({ role: m.role, content: m.text }))],
          ...(request.json ? { response_format: { type: "json_object" } } : {}),
        }),
      },
      fetcher,
      COMPLETE_TIMEOUT_MS,
    )) as { choices?: Array<{ message?: { content?: string | null; refusal?: string | null } }> };
    const message = json.choices?.[0]?.message;
    if (message?.refusal) throw new AiError("refusal");
    return message?.content ?? "";
  }
  const json = (await call(
    provider,
    `${origin}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.system }] },
        contents: request.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.text }] })),
        ...(request.json ? { generationConfig: { responseMimeType: "application/json" } } : {}),
      }),
    },
    fetcher,
    COMPLETE_TIMEOUT_MS,
  )) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; promptFeedback?: { blockReason?: string } };
  if (json.promptFeedback?.blockReason) throw new AiError("refusal");
  return (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
}
