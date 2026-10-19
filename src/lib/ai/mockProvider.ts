/**
 * A fake provider for tests (no network, no key): answers each provider's model list and chat call in its own
 * response shape, with the text a test scripts. Every request is recorded, so tests can check where the key went.
 */
import { AI_ORIGINS } from "./origins";
import type { ProviderId } from "./providers";

export type RecordedRequest = { url: string; method: string; headers: Record<string, string>; body: string };

export function mockProvider(provider: ProviderId, answers: Array<string | { status: number; body: unknown }>, models: string[] = []) {
  const requests: RecordedRequest[] = [];
  const queue = [...answers];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    requests.push({ url, method: init?.method ?? "GET", headers, body: typeof init?.body === "string" ? init.body : "" });
    if (!url.startsWith(AI_ORIGINS[provider])) return Response.json({ error: "not this provider" }, { status: 599 });
    if ((init?.method ?? "GET") === "GET") return Response.json(modelList(provider, models));
    const next = queue.shift() ?? "";
    if (typeof next !== "string") return Response.json(next.body, { status: next.status });
    return Response.json(chatAnswer(provider, next));
  };
  return { fetcher, requests };
}

function modelList(provider: ProviderId, ids: string[]) {
  if (provider === "anthropic") return { data: ids.map((id, i) => ({ id, display_name: id, created_at: new Date(Date.UTC(2026, 0, 1 + i)).toISOString() })) };
  if (provider === "openai") return { data: ids.map((id, i) => ({ id, created: 1_700_000_000 + i })) };
  return { models: ids.map((id) => ({ name: `models/${id}`, displayName: id, supportedGenerationMethods: ["generateContent"] })) };
}

function chatAnswer(provider: ProviderId, text: string) {
  if (provider === "anthropic") return { content: [{ type: "text", text }], stop_reason: "end_turn" };
  if (provider === "openai") return { choices: [{ message: { content: text } }] };
  return { candidates: [{ content: { parts: [{ text }] } }] };
}
