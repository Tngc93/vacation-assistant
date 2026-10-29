import { afterEach, describe, expect, it, vi } from "vitest";
import { EN, TR } from "@/test/i18n";
import { AiError, aiErrorCaption, aiErrorText } from "./errors";
import helpOnly429 from "./__fixtures__/gemini-429-help-only.json";
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
    const error = await failing("anthropic", 401, {});
    expect(error).toBeInstanceOf(AiError);
    expect(aiErrorText(error, TR)).toBe("Anahtar geçersiz ya da bu sağlayıcıya ait değil. Anahtarı kontrol edip yeniden bağlan.");
    expect(aiErrorText(error, EN)).toBe("The key is invalid or not for this provider. Check the key and connect again.");
  });

  it("says when the network fails or the provider is too slow (fake clock)", async () => {
    vi.useFakeTimers();
    let tries = 0;
    const offline: typeof fetch = async () => {
      tries++;
      throw new TypeError("Failed to fetch");
    };
    const failed = complete({ provider: "openai", key: KEY, model: "m" }, { system: "s", messages: [] }, offline).catch((e) => e);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await failed).toMatchObject({ kind: "network" });
    expect(tries).toBe(3);
    const hanging: typeof fetch = (_url, init) =>
      new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)));
    const pending = complete({ provider: "gemini", key: KEY, model: "m" }, { system: "s", messages: [] }, hanging).catch((e) => e);
    await vi.advanceTimersByTimeAsync(120_000);
    const timeout = await pending;
    expect(timeout).toMatchObject({ kind: "timeout" });
    expect(aiErrorText(timeout, TR)).toContain("zamanında cevap vermedi");
  });
});

describe("retries, rate limits and the diagnosis caption (fake clock)", () => {
  afterEach(() => vi.useRealTimers());
  const conn = { provider: "gemini" as const, key: KEY, model: "gemini-3.5-flash" };
  const ask = (fetcher: typeof fetch) => complete(conn, { system: "s", messages: [{ role: "user", text: "u" }] }, fetcher).catch((e: unknown) => e);
  const posts = (mock: ReturnType<typeof mockProvider>) => mock.requests.filter((r) => r.method === "POST").length;
  const busy = { status: 503, body: { error: { code: 503, status: "UNAVAILABLE" } } };
  const geminiLimit = (quotaId: string, extra: Record<string, unknown> = {}, retryDelay?: string) => ({
    status: 429,
    body: {
      error: {
        code: 429,
        status: "RESOURCE_EXHAUSTED",
        details: [
          { "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId, ...extra }] },
          ...(retryDelay ? [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay }] : []),
        ],
      },
    },
  });

  it("tries a busy model again after about 1 s and 3 s and succeeds on the third try", async () => {
    vi.useFakeTimers();
    const mock = mockProvider("gemini", [busy, busy, "plan"]);
    const pending = ask(mock.fetcher);
    await vi.advanceTimersByTimeAsync(700);
    expect(posts(mock)).toBe(1); // the first wait is at least 750 ms
    await vi.advanceTimersByTimeAsync(600);
    expect(posts(mock)).toBe(2); // and at most 1250 ms
    await vi.advanceTimersByTimeAsync(3_750);
    expect(await pending).toBe("plan");
    expect(posts(mock)).toBe(3);
  });

  it("gives up after three busy answers with the 'overloaded' message and caption", async () => {
    vi.useFakeTimers();
    const mock = mockProvider("gemini", [busy, busy, busy, "never asked"]);
    const pending = ask(mock.fetcher);
    await vi.advanceTimersByTimeAsync(10_000);
    const error = await pending;
    expect(error).toMatchObject({ kind: "overloaded", status: 503 });
    expect(aiErrorText(error, TR)).toContain("Bu model şu an çok yoğun.");
    expect(aiErrorCaption(error)).toBe("HTTP 503 · GEMINI-3.5-FLASH");
    expect(posts(mock)).toBe(3);
  });

  it("treats 529 as overloaded and other 5xx as a server fault", async () => {
    vi.useFakeTimers();
    for (const [provider, status, kind] of [
      ["anthropic", 529, "overloaded"],
      ["openai", 500, "server"],
      ["openai", 504, "server"],
    ] as const) {
      const mock = mockProvider(provider, [{ status, body: {} }, { status, body: {} }, { status, body: {} }]);
      const pending = complete({ provider, key: KEY, model: "m" }, { system: "s", messages: [] }, mock.fetcher).catch((e) => e);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(await pending).toMatchObject({ kind, status });
      expect(posts(mock)).toBe(3);
    }
  });

  it("waits out a Gemini per-minute limit the provider says is short, then succeeds", async () => {
    vi.useFakeTimers();
    const mock = mockProvider("gemini", [geminiLimit("GenerateRequestsPerMinutePerProjectPerModel-FreeTier", { quotaValue: "10" }, "5s"), "plan"]);
    const pending = ask(mock.fetcher);
    await vi.advanceTimersByTimeAsync(4_900);
    expect(posts(mock)).toBe(1);
    await vi.advanceTimersByTimeAsync(200);
    expect(await pending).toBe("plan");
    expect(posts(mock)).toBe(2);
  });

  it("names the wait when a per-minute limit is long, without trying again", async () => {
    const mock = mockProvider("gemini", [geminiLimit("GenerateRequestsPerMinutePerProjectPerModel-FreeTier", { quotaValue: "10" }, "24.3s")]);
    const error = await ask(mock.fetcher);
    expect(error).toMatchObject({ kind: "rate" });
    expect(aiErrorText(error, TR)).toBe("Sağlayıcı şu an çok fazla istek aldığını söylüyor. Yaklaşık 25 saniye sonra yeniden dene.");
    expect(aiErrorText(error, EN)).toBe("The provider says it is getting too many requests right now. Try again in about 25 seconds.");
    expect(posts(mock)).toBe(1);
  });

  it("does not take a Gemini 429 that names no quota and no wait for a per-minute limit, and never retries it", async () => {
    vi.useFakeTimers();
    const mock = mockProvider("gemini", [{ status: 429, body: helpOnly429 }, "never asked"]);
    const pending = ask(mock.fetcher);
    await vi.advanceTimersByTimeAsync(10_000);
    const error = (await pending) as AiError;
    expect(error).toMatchObject({
      kind: "quotaUnknown",
      status: 429,
      retryAfterMs: undefined,
    });
    expect(aiErrorText(error, TR)).toBe(
      "Google kota sınırına takıldığını söylüyor ama hangi sınır olduğunu belirtmedi. Bir dakika bekleyip yeniden dene; tekrarlarsa ai.dev/rate-limit sayfasından kullanımına bak.",
    );
    expect(aiErrorText(error, TR)).not.toContain("exceeded");
    expect(posts(mock)).toBe(1);
  });

  it("upper-cases the caption without Turkish rules: GEMINI, not GEMİNİ", () => {
    expect(aiErrorCaption(new AiError("quotaUnknown", { status: 429, model: "gemini-3.6-flash" }))).toBe("HTTP 429 · GEMINI-3.6-FLASH");
    expect(aiErrorCaption(new AiError("invalid", { model: "gemini-2.5-flash" }))).toBe("GEMINI-2.5-FLASH");
  });

  it("calls a per-day limit a quota and asks only once", async () => {
    const mock = mockProvider("gemini", [geminiLimit("GenerateRequestsPerDayPerProjectPerModel-FreeTier", { quotaValue: "250" }, "3s"), "plan"]);
    expect(await ask(mock.fetcher)).toMatchObject({ kind: "quota", status: 429 });
    expect(posts(mock)).toBe(1);
  });

  it("says a model with a free-tier limit of 0 cannot be used on the free tier", async () => {
    const mock = mockProvider("gemini", [geminiLimit("GenerateRequestsPerMinutePerProjectPerModel-FreeTier", { quotaValue: "0" }, "5s")]);
    const error = await ask(mock.fetcher);
    expect(error).toMatchObject({ kind: "freeTier" });
    expect(aiErrorText(error, TR)).toBe("Bu model ücretsiz katmanda kullanılamıyor. Bağlantı ayarları'ndan başka bir model seç.");
    expect(posts(mock)).toBe(1);
  });

  it("uses the Retry-After header for other providers", async () => {
    vi.useFakeTimers();
    const limited = { status: 429, body: { error: { type: "rate_limit_error" } }, headers: { "retry-after": "2" } };
    const mock = mockProvider("anthropic", [limited, "ok"]);
    const pending = complete({ provider: "anthropic", key: KEY, model: "claude-haiku-5-5" }, { system: "s", messages: [] }, mock.fetcher).catch((e) => e);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(await pending).toBe("ok");
    const long = mockProvider("openai", [{ status: 429, body: { error: { code: "rate_limit_exceeded" } }, headers: { "retry-after": "40" } }]);
    const error = await complete({ provider: "openai", key: KEY, model: "m" }, { system: "s", messages: [] }, long.fetcher).catch((e) => e);
    expect(error).toMatchObject({ kind: "rate" });
    expect(aiErrorText(error, TR)).toContain("Yaklaşık 40 saniye sonra yeniden dene.");
    expect(posts(long)).toBe(1);
  });

  it("never retries a 400 or an aborted request", async () => {
    const bad = mockProvider("gemini", [{ status: 400, body: { error: { code: 400, status: "INVALID_ARGUMENT" } } }, "plan"]);
    const error = await ask(bad.fetcher);
    expect(error).toMatchObject({ kind: "request", status: 400 });
    expect(aiErrorText(error, TR)).toBe("Sağlayıcı bu isteği kabul etmedi. Bağlantı ayarları'ndan başka bir model seçip yeniden dene.");
    expect(aiErrorCaption(error)).toBe("HTTP 400 · GEMINI-3.5-FLASH");
    expect(posts(bad)).toBe(1);
    // A 400 that says the key is wrong is still about the key.
    const wrongKey = mockProvider("gemini", [{ status: 400, body: { error: { code: 400, status: "INVALID_ARGUMENT", details: [{ reason: "API_KEY_INVALID" }] } } }]);
    expect(await ask(wrongKey.fetcher)).toMatchObject({ kind: "auth", status: 400 });
    expect(posts(wrongKey)).toBe(1);
    let tries = 0;
    const aborted: typeof fetch = async () => {
      tries++;
      throw new DOMException("The operation was aborted.", "AbortError");
    };
    expect(await ask(aborted)).toMatchObject({ kind: "timeout" });
    expect(tries).toBe(1);
  });

  it("stops waiting between tries when the deadline passes", async () => {
    vi.useFakeTimers();
    let tries = 0;
    const slowThenBusy: typeof fetch = (_url, init) =>
      new Promise((resolve, reject) => {
        tries++;
        const timer = setTimeout(() => resolve(Response.json({}, { status: 503 })), 119_500);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(init.signal!.reason);
        });
      });
    const pending = ask(slowThenBusy);
    await vi.advanceTimersByTimeAsync(121_000);
    expect(await pending).toMatchObject({ kind: "timeout" });
    expect(tries).toBe(1);
  });

  it("shows only the status and the model in the caption, never the key or the provider's text", async () => {
    vi.useFakeTimers();
    const leaky = { status: 503, body: { error: { code: 503, message: `Key ${KEY} is overloaded`, status: "UNAVAILABLE" } } };
    const mock = mockProvider("gemini", [leaky, leaky, leaky]);
    const pending = ask(mock.fetcher);
    await vi.advanceTimersByTimeAsync(10_000);
    const error = (await pending) as AiError;
    expect(aiErrorCaption(error)).toBe("HTTP 503 · GEMINI-3.5-FLASH");
    expect(JSON.stringify({ ...error, message: aiErrorText(error, TR), caption: aiErrorCaption(error) })).not.toContain(KEY);
    expect(aiErrorText(error, TR)).not.toContain("overloaded");
  });
});

describe("Gemini model list", () => {
  it("lists previews, experiments and omni models last and suggests a plain Flash", async () => {
    const mock = mockProvider("gemini", [], [
      "gemini-3.5-flash-omni",
      "gemini-3.6-flash-preview",
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
      "gemini-3.5-pro",
      "gemini-2.0-flash-exp",
    ]);
    const models = await listModels("gemini", KEY, mock.fetcher);
    expect(models.map((m) => m.id)).toEqual([
      "gemini-3.5-pro",
      "gemini-3.5-flash-lite",
      "gemini-3.5-flash",
      "gemini-3.6-flash-preview",
      "gemini-3.5-flash-omni",
      "gemini-2.0-flash-exp",
    ]);
    expect(suggestModel("gemini", models)).toBe("gemini-3.5-flash");
    const list = (ids: string[]) => ids.map((id) => ({ id, label: id, created: 0 }));
    expect(suggestModel("gemini", list(["gemini-3.6-flash-preview", "gemini-3.5-flash-lite", "gemini-3.5-flash-omni"]))).toBe("gemini-3.5-flash-lite");
  });
});
