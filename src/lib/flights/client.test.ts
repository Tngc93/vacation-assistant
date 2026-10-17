import { describe, expect, it, vi } from "vitest";
import { IST_BCN as ist } from "./__fixtures__/samples";
import { fetchPrices, flightsConfig, FLIGHTS_REVALIDATE_SECONDS, type Fetcher } from "./client";

const query = { origin: "IST", destination: "BCN", departureAt: "2026-11-14", returnAt: "2026-11-18", direct: false, limit: 30 };
const TOKEN = "test-token-not-real";
const reply = (status: number, body: unknown = {}) => vi.fn<Fetcher>(async () => Response.json(body, { status }));

describe("fetchPrices", () => {
  it("sends the token only in the X-Access-Token header, with a 1 hour cache", async () => {
    const fetcher = reply(200, ist);
    const outcome = await fetchPrices(query, { token: TOKEN, fetcher });
    expect(outcome.ok && outcome.tickets).toHaveLength(6);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).not.toContain(TOKEN);
    expect(new Headers(init.headers).get("X-Access-Token")).toBe(TOKEN);
    expect(init.next).toEqual({ revalidate: FLIGHTS_REVALIDATE_SECONDS });
    expect(FLIGHTS_REVALIDATE_SECONDS).toBe(3600);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("tells 401, 429 and 5xx apart", async () => {
    const outcome = (status: number) => fetchPrices(query, { token: TOKEN, fetcher: reply(status) });
    expect(await outcome(401)).toEqual({ ok: false, reason: "unauthorized" });
    expect(await outcome(429)).toEqual({ ok: false, reason: "rate-limited" });
    expect(await outcome(500)).toEqual({ ok: false, reason: "server" });
    expect(await outcome(502)).toEqual({ ok: false, reason: "server" });
  });

  it("gives up after 4 seconds", async () => {
    vi.useFakeTimers();
    const fetcher: Fetcher = (_url, init) =>
      new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(init.signal?.reason)));
    const pending = fetchPrices(query, { token: TOKEN, fetcher });
    await vi.advanceTimersByTimeAsync(4_000);
    expect(await pending).toEqual({ ok: false, reason: "timeout" });
  });

  it("reports network failures, unreadable bodies and API errors without throwing", async () => {
    const offline: Fetcher = async () => {
      throw new TypeError("fetch failed");
    };
    expect(await fetchPrices(query, { token: TOKEN, fetcher: offline })).toEqual({ ok: false, reason: "unavailable" });
    const html: Fetcher = async () => new Response("<html>", { status: 200 });
    expect(await fetchPrices(query, { token: TOKEN, fetcher: html })).toEqual({ ok: false, reason: "unavailable" });
    expect(await fetchPrices(query, { token: TOKEN, fetcher: reply(200, { success: false, data: {}, error: "bad" }) })).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });
});

describe("flightsConfig", () => {
  it("reads the token, a numeric marker and the project id from the server environment", () => {
    vi.stubEnv("TRAVELPAYOUTS_TOKEN", " abc ");
    vi.stubEnv("TRAVELPAYOUTS_MARKER", "12345");
    vi.stubEnv("TRAVELPAYOUTS_PROJECT_ID", "678");
    expect(flightsConfig()).toEqual({ token: "abc", partner: { marker: "12345", trs: "678" } });
    vi.stubEnv("TRAVELPAYOUTS_TOKEN", "");
    vi.stubEnv("TRAVELPAYOUTS_MARKER", "not-a-marker");
    vi.stubEnv("TRAVELPAYOUTS_PROJECT_ID", "");
    expect(flightsConfig()).toEqual({ token: null, partner: { marker: null, trs: null } });
    vi.unstubAllEnvs();
  });
});
