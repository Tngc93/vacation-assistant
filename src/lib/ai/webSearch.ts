/**
 * The model's own web search, called straight from the browser like every other AI call (the key never reaches
 * our server). One request per search; the answer is text with a JSON block (none of the three providers is
 * asked for JSON mode: see below) plus the provider's own list of the pages it found, which is what every link
 * we show must come from.
 *
 * Checked against the official docs on 2026-10-21:
 * - Anthropic: Messages API server tool `{ type: "web_search_20250305", name: "web_search" }` (basic search,
 *   no dynamic filtering, so it also works on models without programmatic tool calling, e.g. Haiku). Pages come
 *   back in `web_search_tool_result` blocks (`url`, `title`) and as `web_search_result_location` citations on text
 *   blocks. $10 per 1,000 searches. A long turn may stop with `pause_turn`: the paused content is sent back once.
 *   Search errors arrive inside a 200 response as `web_search_tool_result_error` with an `error_code`.
 * - OpenAI: Responses API `POST /v1/responses` with `tools: [{ type: "web_search" }]` and
 *   `include: ["web_search_call.action.sources"]`; pages are `url_citation` annotations on `output_text` and the
 *   `sources` of each `web_search_call`. $10 per 1,000 calls plus search content tokens.
 * - Gemini: `generateContent` (still fully supported next to the Interactions API) with
 *   `tools: [{ google_search: {} }]`; pages are `groundingMetadata.groundingChunks[].web` (`uri`, `title`), where
 *   `uri` is a Google redirect (vertexaisearch.cloud.google.com) and `title` the site's domain. The terms
 *   (https://ai.google.dev/gemini-api/terms#grounding-with-google-search) require showing the grounded result
 *   unmodified with its Search Suggestions (`searchEntryPoint.renderedContent`), so Gemini answers are not parsed
 *   for prices (see `searchGrounded` in webPrices.ts).
 *   Free tier: Gemini 2.5 Flash and Flash-Lite, 500 grounded requests a day (shared); not available on the free
 *   tier for Gemini 3 models (pricing page, last updated 2026-10-19).
 * - JSON together with the search tool: the Anthropic and OpenAI web search pages do not document it, so they
 *   answer in text and we take the JSON block out of it (`extractJson`) and check it with zod.
 * - Showing results: Anthropic requires citations to the original source when showing outputs to end users;
 *   OpenAI requires citations to be "clearly visible and clickable". Every result keeps its source link visible.
 * - CORS: preflights for /v1/messages, /v1/responses and :generateContent answer from any origin (2026-10-21).
 *   The origins are the same as the chat calls, so the Content-Security-Policy needs no new entry.
 */
import { AiError } from "./errors";
import { call, PROVIDERS, type Connection } from "./providers";

type Fetch = typeof fetch;

/** A page the provider says the search found: the only links we may show. */
export type WebSource = { url: string; title: string };

export type WebSearchAnswer = {
  text: string;
  sources: WebSource[];
  /** Gemini's Search Suggestions (HTML from Google), shown unmodified with the result as the terms require. */
  suggestionsHtml: string | null;
  /** Gemini's webSearchQueries. */
  queries: string[];
};

export const WEB_SEARCH_TIMEOUT_MS = 150_000;
/** Searches per request (Anthropic `max_uses`): enough to compare a few sites, a cap on the user's bill. */
export const MAX_SEARCHES = 5;

const anthropicHeaders = (key: string) => ({
  "x-api-key": key,
  "anthropic-version": "2023-06-01",
  "anthropic-dangerous-direct-browser-access": "true",
  "content-type": "application/json",
});

const uniqueSources = (sources: WebSource[]): WebSource[] => {
  const seen = new Set<string>();
  return sources.filter((s) => {
    if (!s.url || seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
};

type AnthropicBlock = {
  type: string;
  text?: string;
  citations?: Array<{ type?: string; url?: string; title?: string }>;
  content?: Array<{ type?: string; url?: string; title?: string }> | { type?: string; error_code?: string };
};

/** Text and pages from an Anthropic answer; an error code when every search failed. */
export function readAnthropic(content: readonly AnthropicBlock[]): { text: string; sources: WebSource[]; errorCode: string | null } {
  const sources: WebSource[] = [];
  let errorCode: string | null = null;
  let text = "";
  for (const block of content) {
    if (block.type === "text") {
      text += block.text ?? "";
      for (const c of block.citations ?? []) if (c.url) sources.push({ url: c.url, title: c.title ?? c.url });
    } else if (block.type === "web_search_tool_result") {
      if (Array.isArray(block.content)) {
        for (const r of block.content) if (r.url) sources.push({ url: r.url, title: r.title ?? r.url });
      } else if (block.content?.type === "web_search_tool_result_error") {
        errorCode = block.content.error_code ?? "unavailable";
      }
    }
  }
  return { text, sources: uniqueSources(sources), errorCode: sources.length ? null : errorCode };
}

type OpenAiItem = {
  type: string;
  action?: { sources?: Array<{ type?: string; url?: string; title?: string }> };
  content?: Array<{ type: string; text?: string; annotations?: Array<{ type?: string; url?: string; title?: string }> }>;
};

export function readOpenAi(output: readonly OpenAiItem[]): { text: string; sources: WebSource[] } {
  const sources: WebSource[] = [];
  let text = "";
  for (const item of output) {
    if (item.type === "web_search_call") {
      for (const s of item.action?.sources ?? []) if (s.url) sources.push({ url: s.url, title: s.title ?? s.url });
    } else if (item.type === "message") {
      for (const part of item.content ?? []) {
        if (part.type !== "output_text") continue;
        text += part.text ?? "";
        for (const a of part.annotations ?? []) if (a.type === "url_citation" && a.url) sources.push({ url: a.url, title: a.title ?? a.url });
      }
    }
  }
  return { text, sources: uniqueSources(sources) };
}

type GeminiCandidate = {
  content?: { parts?: Array<{ text?: string }> };
  groundingMetadata?: {
    groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
    searchEntryPoint?: { renderedContent?: string };
    webSearchQueries?: string[];
  };
};

export function readGemini(candidate: GeminiCandidate | undefined): WebSearchAnswer {
  const meta = candidate?.groundingMetadata;
  return {
    text: (candidate?.content?.parts ?? []).map((p) => p.text ?? "").join(""),
    sources: uniqueSources((meta?.groundingChunks ?? []).flatMap((c) => (c.web?.uri ? [{ url: c.web.uri, title: c.web.title ?? "" }] : []))),
    suggestionsHtml: meta?.searchEntryPoint?.renderedContent || null,
    queries: (meta?.webSearchQueries ?? []).filter((q): q is string => typeof q === "string").slice(0, 10),
  };
}

/** Anthropic's search error codes, as our error kinds. */
function anthropicSearchError(code: string, model: string): AiError {
  if (code === "too_many_requests") return new AiError("rate", { model });
  if (code === "invalid_tool_input" || code === "query_too_long" || code === "request_too_large") return new AiError("request", { model });
  return new AiError("server", { model });
}

/** One web search by the model; throws AiError (Turkish message, HTTP status and model for the caption). */
export async function webSearch(conn: Connection, request: { system: string; prompt: string }, fetcher: Fetch = fetch): Promise<WebSearchAnswer> {
  const { provider, key, model } = conn;
  const origin = PROVIDERS[provider].origin;
  if (provider === "anthropic") {
    const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [{ role: "user", content: request.prompt }];
    const blocks: AnthropicBlock[] = [];
    // A paused turn is continued by sending its content back unchanged; once is enough for a handful of searches.
    for (let turn = 0; turn < 2; turn++) {
      const json = (await call(
        provider,
        `${origin}/v1/messages`,
        {
          method: "POST",
          headers: anthropicHeaders(key),
          body: JSON.stringify({
            model,
            max_tokens: 4096,
            system: request.system,
            messages,
            tools: [{ type: "web_search_20250305", name: "web_search", max_uses: MAX_SEARCHES }],
          }),
        },
        fetcher,
        WEB_SEARCH_TIMEOUT_MS,
        model,
      )) as { content?: AnthropicBlock[]; stop_reason?: string };
      if (json.stop_reason === "refusal") throw new AiError("refusal", { model });
      blocks.push(...(json.content ?? []));
      if (json.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: json.content ?? [] });
    }
    const read = readAnthropic(blocks);
    if (read.errorCode) throw anthropicSearchError(read.errorCode, model);
    return { text: read.text, sources: read.sources, suggestionsHtml: null, queries: [] };
  }
  if (provider === "openai") {
    const json = (await call(
      provider,
      `${origin}/v1/responses`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          instructions: request.system,
          input: request.prompt,
          tools: [{ type: "web_search" }],
          include: ["web_search_call.action.sources"],
        }),
      },
      fetcher,
      WEB_SEARCH_TIMEOUT_MS,
      model,
    )) as { output?: OpenAiItem[] };
    return { ...readOpenAi(json.output ?? []), suggestionsHtml: null, queries: [] };
  }
  const json = (await call(
    provider,
    `${origin}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.system }] },
        contents: [{ role: "user", parts: [{ text: request.prompt }] }],
        tools: [{ google_search: {} }],
      }),
    },
    fetcher,
    WEB_SEARCH_TIMEOUT_MS,
    model,
  )) as { candidates?: GeminiCandidate[]; promptFeedback?: { blockReason?: string } };
  if (json.promptFeedback?.blockReason) throw new AiError("refusal", { model });
  return readGemini(json.candidates?.[0]);
}
