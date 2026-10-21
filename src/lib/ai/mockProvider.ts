/**
 * A fake provider for tests and the keyless demo (no network, no key): answers each provider's model list, chat
 * call and web search in its own response shape, with the text a test scripts. Every request is recorded, so
 * tests can check where the key went.
 */
import { AI_ORIGINS } from "./origins";
import type { ProviderId } from "./providers";
import type { WebSource } from "./webSearch";

export type RecordedRequest = { url: string; method: string; headers: Record<string, string>; body: string };

/** A web search answer: the model's text and the pages the provider lists as found. */
export type MockSearch = { search: { text: string; sources: WebSource[]; suggestionsHtml?: string } };
export type MockAnswer = string | { status: number; body: unknown; headers?: Record<string, string> } | MockSearch;

export function mockProvider(provider: ProviderId, answers: MockAnswer[], models: string[] = []) {
  const requests: RecordedRequest[] = [];
  const queue = [...answers];
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    requests.push({ url, method: init?.method ?? "GET", headers, body: typeof init?.body === "string" ? init.body : "" });
    if (!url.startsWith(AI_ORIGINS[provider])) return Response.json({ error: "not this provider" }, { status: 599 });
    if ((init?.method ?? "GET") === "GET") return Response.json(modelList(provider, models));
    const next = queue.shift() ?? "";
    if (typeof next === "string") return Response.json(chatAnswer(provider, next));
    if ("search" in next) return Response.json(searchAnswer(provider, next.search));
    return Response.json(next.body, { status: next.status, headers: next.headers });
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

/** Shapes from each provider's web search docs (checked 2026-10-21; see webSearch.ts). */
export function searchAnswer(provider: ProviderId, { text, sources, suggestionsHtml }: MockSearch["search"]) {
  if (provider === "anthropic") {
    return {
      stop_reason: "end_turn",
      content: [
        { type: "server_tool_use", id: "srvtoolu_mock", name: "web_search", input: { query: "prices" } },
        {
          type: "web_search_tool_result",
          tool_use_id: "srvtoolu_mock",
          content: sources.map((s) => ({ type: "web_search_result", url: s.url, title: s.title, encrypted_content: "x", page_age: null })),
        },
        {
          type: "text",
          text,
          citations: sources.slice(0, 1).map((s) => ({ type: "web_search_result_location", url: s.url, title: s.title, cited_text: "…" })),
        },
      ],
    };
  }
  if (provider === "openai") {
    return {
      output: [
        { type: "web_search_call", id: "ws_mock", status: "completed", action: { type: "search", query: "prices", sources: sources.map((s) => ({ type: "url", url: s.url })) } },
        {
          type: "message",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text,
              annotations: sources.map((s) => ({ type: "url_citation", url: `${s.url}${s.url.includes("?") ? "&" : "?"}utm_source=openai`, title: s.title, start_index: 0, end_index: 1 })),
            },
          ],
        },
      ],
    };
  }
  return {
    candidates: [
      {
        content: { parts: [{ text }] },
        groundingMetadata: {
          webSearchQueries: ["prices"],
          groundingChunks: sources.map((s) => ({ web: { uri: s.url, title: s.title } })),
          ...(suggestionsHtml ? { searchEntryPoint: { renderedContent: suggestionsHtml } } : {}),
        },
      },
    ],
  };
}

const DEMO_FLIGHTS = {
  text:
    "```json\n" +
    JSON.stringify({
      results: [
        { title: "Örnek havayolu · aktarmasız gidiş-dönüş", price: 8450, currency: "TRY", basis: "per_person", url: "https://example.com/ornek-ucus-1" },
        { title: "Örnek havayolu 2 · tek aktarmalı", price: 410, currency: "EUR", basis: "total", url: "https://example.com/ornek-ucus-2" },
        // Not in the source list: the page drops it.
        { title: "Kaynaksız fiyat", price: 100, currency: "TRY", basis: "per_person", url: "https://example.org/uydurma" },
      ],
    }) +
    "\n```",
  sources: [
    { url: "https://example.com/ornek-ucus-1", title: "Örnek uçuş sayfası 1" },
    { url: "https://example.com/ornek-ucus-2", title: "Örnek uçuş sayfası 2" },
  ],
};

const DEMO_STAYS = {
  text:
    "```json\n" +
    JSON.stringify({
      areas: [
        { name: "Örnek semt A · merkez", min: 3200, max: 5400, currency: "TRY", basis: "per_night", url: "https://example.com/ornek-otel-a" },
        { name: "Örnek semt B · sakin", min: 2400, max: 3600, currency: "TRY", basis: "per_night", url: "https://example.com/ornek-otel-b" },
        { name: "Örnek semt C · sahil", min: 90, max: 150, currency: "EUR", basis: "per_night", url: "https://example.com/ornek-otel-c" },
      ],
    }) +
    "\n```",
  sources: [
    { url: "https://example.com/ornek-otel-a", title: "Örnek otel sayfası A" },
    { url: "https://example.com/ornek-otel-b", title: "Örnek otel sayfası B" },
    { url: "https://example.com/ornek-otel-c", title: "Örnek otel sayfası C" },
  ],
};

/**
 * The keyless demo (VA_AI_MOCK=1, never on Vercel): fixed sample answers, flights or stays by the request, in the
 * OpenAI shape (the structured path with prices, lira estimates and budget buttons).
 */
export const demoWebSearchFetcher: typeof fetch = async (_input, init) => {
  const body = typeof init?.body === "string" ? init.body : "";
  return Response.json(searchAnswer("openai", body.includes("hotel prices") ? DEMO_STAYS : DEMO_FLIGHTS));
};
