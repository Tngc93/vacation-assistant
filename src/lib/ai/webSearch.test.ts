import { describe, expect, it } from "vitest";
import { mockProvider, searchAnswer } from "./mockProvider";
import type { Connection, ProviderId } from "./providers";
import { readAnthropic, readGemini, readOpenAi, webSearch } from "./webSearch";

const KEY = "test-key-not-real";
const conn = (provider: ProviderId): Connection => ({ provider, key: KEY, model: "test-model" });
const SOURCES = [
  { url: "https://www.example.com/flights/ist-bcn", title: "Example flights" },
  { url: "https://fares.example.org/deal", title: "Example fares" },
];

describe("reading each provider's pages from a web search answer", () => {
  it("Anthropic: search results and citations, deduplicated, with the text", () => {
    const body = searchAnswer("anthropic", { text: "```json\n{}\n```", sources: SOURCES });
    expect(readAnthropic(body.content!)).toEqual({ text: "```json\n{}\n```", sources: SOURCES, errorCode: null });
  });

  it("Anthropic: a search that failed in a 200 answer gives its error code", () => {
    const content = [{ type: "web_search_tool_result", content: { type: "web_search_tool_result_error", error_code: "too_many_requests" } }];
    expect(readAnthropic(content)).toMatchObject({ sources: [], errorCode: "too_many_requests" });
  });

  it("OpenAI: web_search_call sources and url_citation annotations", () => {
    const body = searchAnswer("openai", { text: "answer", sources: SOURCES });
    const read = readOpenAi(body.output!);
    expect(read.text).toBe("answer");
    // The call's sources and the citations (with OpenAI's utm_source) are both kept; matching ignores utm_.
    expect(read.sources.map((s) => s.url)).toEqual([...SOURCES.map((s) => s.url), ...SOURCES.map((s) => `${s.url}?utm_source=openai`)]);
  });

  it("Gemini: grounding chunks (Google redirect links titled with the domain) and the Search Suggestions", () => {
    const body = {
      candidates: [
        {
          content: { parts: [{ text: "part 1 " }, { text: "part 2" }] },
          groundingMetadata: {
            webSearchQueries: ["ist bcn flights"],
            searchEntryPoint: { renderedContent: "<div class=\"chip\">ist bcn</div>" },
            groundingChunks: [
              { web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AbC", title: "pegasus.com" } },
              { retrievedContext: {} },
            ],
          },
        },
      ],
    };
    expect(readGemini(body.candidates[0])).toEqual({
      text: "part 1 part 2",
      sources: [{ url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AbC", title: "pegasus.com" }],
      suggestionsHtml: "<div class=\"chip\">ist bcn</div>",
      queries: ["ist bcn flights"],
    });
  });
});

describe("web search requests", () => {
  it("asks each provider with its own search tool, no JSON mode, the key only in a header", async () => {
    for (const provider of ["anthropic", "openai", "gemini"] as const) {
      const mock = mockProvider(provider, [{ search: { text: "t", sources: SOURCES } }]);
      const answer = await webSearch(conn(provider), { system: "s", prompt: "DATA:\n{}" }, mock.fetcher);
      expect(answer.sources.length).toBeGreaterThan(0);
      const [request] = mock.requests;
      expect(request.url).not.toContain(KEY);
      expect(request.body).not.toContain(KEY);
      const body = JSON.parse(request.body);
      if (provider === "anthropic") {
        expect(request.url).toBe("https://api.anthropic.com/v1/messages");
        expect(body.tools).toEqual([{ type: "web_search_20250305", name: "web_search", max_uses: 5 }]);
        expect(request.headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
      } else if (provider === "openai") {
        expect(request.url).toBe("https://api.openai.com/v1/responses");
        expect(body).toMatchObject({ tools: [{ type: "web_search" }], include: ["web_search_call.action.sources"], instructions: "s" });
        expect(body.text).toBeUndefined();
      } else {
        expect(request.url).toBe("https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent");
        expect(body.tools).toEqual([{ google_search: {} }]);
        expect(body.generationConfig).toBeUndefined();
      }
    }
  });

  it("continues an Anthropic turn paused mid-search once, by sending its content back", async () => {
    const paused = { status: 200, body: { stop_reason: "pause_turn", content: [{ type: "web_search_tool_result", content: [{ type: "web_search_result", ...SOURCES[0] }] }] } };
    const mock = mockProvider("anthropic", [paused, { search: { text: "done", sources: [SOURCES[1]] } }]);
    const answer = await webSearch(conn("anthropic"), { system: "s", prompt: "p" }, mock.fetcher);
    expect(answer.text).toBe("done");
    expect(answer.sources.map((s) => s.url)).toEqual([SOURCES[0].url, SOURCES[1].url]);
    expect(JSON.parse(mock.requests[1].body).messages.at(-1)).toMatchObject({ role: "assistant" });
  });

  it("turns Anthropic's in-answer search errors into our error kinds", async () => {
    const failed = { status: 200, body: { stop_reason: "end_turn", content: [{ type: "web_search_tool_result", content: { type: "web_search_tool_result_error", error_code: "too_many_requests" } }] } };
    const error = await webSearch(conn("anthropic"), { system: "s", prompt: "p" }, mockProvider("anthropic", [failed]).fetcher).catch((e) => e);
    expect(error).toMatchObject({ kind: "rate", model: "test-model" });
  });
});
