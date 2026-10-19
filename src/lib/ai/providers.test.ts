import { afterEach, describe, expect, it, vi } from "vitest";
import { AiError } from "./errors";
import { mockProvider } from "./mockProvider";
import { complete, listModels, PROVIDERS, suggestModel } from "./providers";

const KEY = "test-key-not-real";

describe("provider calls", () => {
  it("lists Anthropic models from the browser with the direct-access header, the key only in a header", async () => {
    const mock = mockProvider("anthropic", [], ["claude-haiku-5-5", "claude-opus-5-5", "claude-sonnet-5-5"]);
    const models = await listModels("anthropic", KEY, mock.fetcher);
    expect(models.map((m) => m.id)).toEqual(["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"]);
    const [request] = mock.requests;
    expect(request.url).toBe("https://api.anthropic.com/v1/models?limit=100");
    expect(request.headers).toMatchObject({ "x-api-key": KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" });
    expect(request.url).not.toContain(KEY);
  });

  it("keeps only chat models from OpenAI and Gemini", async () => {
    const openai = mockProvider("openai", [], ["text-embedding-3-small", "gpt-5-mini", "whisper-1", "gpt-5", "gpt-realtime"]);
    expect((await listModels("openai", KEY, openai.fetcher)).map((m) => m.id).sort()).toEqual(["gpt-5", "gpt-5-mini"]);
    expect(openai.requests[0].headers.authorization).toBe(`Bearer ${KEY}`);
    const gemini = mockProvider("gemini", [], ["gemini-2.5-flash", "gemini-2.5-flash-image", "embedding-001", "gemini-2.5-pro"]);
    expect((await listModels("gemini", KEY, gemini.fetcher)).map((m) => m.id)).toEqual(["gemini-2.5-pro", "gemini-2.5-flash"]);
    expect(gemini.requests[0].headers["x-goog-api-key"]).toBe(KEY);
  });

  it("suggests a fast, inexpensive model by family, not by a fixed name", () => {
    const list = (ids: string[]) => ids.map((id, i) => ({ id, label: id, created: ids.length - i }));
    expect(suggestModel("anthropic", list(["claude-opus-5-5", "claude-haiku-5-5", "claude-haiku-4-5"]))).toBe("claude-haiku-5-5");
    expect(suggestModel("openai", list(["gpt-5", "gpt-5-mini", "gpt-4o-mini"]))).toBe("gpt-5-mini");
    expect(suggestModel("gemini", list(["gemini-3.8-flash-preview", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"]))).toBe(
      "gemini-2.5-flash",
    );
    expect(suggestModel("openai", [])).toBeNull();
  });

  it("reads each provider's answer text and asks for JSON where the provider supports it", async () => {
    for (const provider of ["anthropic", "openai", "gemini"] as const) {
      const mock = mockProvider(provider, ['{"ok":true}']);
      const text = await complete({ provider, key: KEY, model: "m" }, { system: "s", messages: [{ role: "user", text: "u" }], json: true }, mock.fetcher);
      expect(text).toBe('{"ok":true}');
      expect(mock.requests[0].url.startsWith(PROVIDERS[provider].origin)).toBe(true);
    }
    const openai = mockProvider("openai", ["{}"]);
    await complete({ provider: "openai", key: KEY, model: "m" }, { system: "s", messages: [], json: true }, openai.fetcher);
    expect(JSON.parse(openai.requests[0].body)).toMatchObject({ response_format: { type: "json_object" }, messages: [{ role: "system", content: "s" }] });
  });
});

describe("provider errors in Turkish", () => {
  afterEach(() => vi.useRealTimers());
  const failing = (provider: "anthropic" | "openai" | "gemini", status: number, body: unknown) =>
    complete({ provider, key: KEY, model: "m" }, { system: "s", messages: [] }, mockProvider(provider, [{ status, body }]).fetcher).catch((e) => e);

  it("tells an invalid key, an empty quota, a rate limit and a missing model apart", async () => {
    expect(await failing("anthropic", 401, { type: "error", error: { type: "authentication_error" } })).toMatchObject({ kind: "auth" });
    expect(await failing("gemini", 400, { error: { code: 400, status: "INVALID_ARGUMENT", details: [{ reason: "API_KEY_INVALID" }] } })).toMatchObject({
      kind: "auth",
    });
    expect(await failing("openai", 429, { error: { code: "insufficient_quota" } })).toMatchObject({ kind: "quota" });
    expect(await failing("openai", 429, { error: { code: "rate_limit_exceeded" } })).toMatchObject({ kind: "rate" });
    expect(await failing("openai", 404, { error: { code: "model_not_found" } })).toMatchObject({ kind: "model" });
    expect(await failing("anthropic", 529, { type: "error", error: { type: "overloaded_error" } })).toMatchObject({ kind: "server" });
    const error = await failing("anthropic", 401, {});
    expect(error).toBeInstanceOf(AiError);
    expect(error.message).toBe("Anahtar geçersiz ya da bu sağlayıcıya ait değil. Anahtarı kontrol edip yeniden bağlan.");
  });

  it("says when the network fails or the provider is too slow (fake clock)", async () => {
    const offline: typeof fetch = async () => {
      throw new TypeError("Failed to fetch");
    };
    expect(await complete({ provider: "openai", key: KEY, model: "m" }, { system: "s", messages: [] }, offline).catch((e) => e)).toMatchObject({
      kind: "network",
    });
    vi.useFakeTimers();
    const hanging: typeof fetch = (_url, init) =>
      new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)));
    const pending = complete({ provider: "gemini", key: KEY, model: "m" }, { system: "s", messages: [] }, hanging).catch((e) => e);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(await pending).toMatchObject({ kind: "timeout", message: expect.stringContaining("zamanında cevap vermedi") });
  });
});
