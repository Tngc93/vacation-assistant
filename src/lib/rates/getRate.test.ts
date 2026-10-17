import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { getTryRate, RATE_REVALIDATE_SECONDS } from "./getRate";
import type { Fetcher } from "./types";

const fixture = (name: string) => readFileSync(path.join(__dirname, "__fixtures__", name), "utf8");

type Reply = Response | "hang" | Error;
type Routes = Partial<Record<"tcmb" | "frankfurter" | "erapi", Reply | ((url: string) => Reply)>>;

const ok = (body: string, type = "application/json") => new Response(body, { status: 200, headers: { "content-type": type } });
const status = (code: number, body = "{}") => new Response(body, { status: code });

const TCMB = () => ok(fixture("tcmb-today.xml"), "application/xml");
const FRANKFURTER_404 = () => status(404, '{"message":"not found"}');
const ERAPI_UNSUPPORTED = () => ok('{"result":"error","error-type":"unsupported-code"}');

function fakeFetch(routes: Routes) {
  return vi.fn<Fetcher>((url, init) => {
    const key = url.includes("tcmb.gov.tr") ? "tcmb" : url.includes("frankfurter") ? "frankfurter" : "erapi";
    const route = routes[key];
    const reply = typeof route === "function" ? route(url) : route;
    if (reply === undefined) return Promise.reject(new Error(`unexpected request ${url}`));
    if (reply instanceof Error) return Promise.reject(reply);
    if (reply === "hang") {
      // Never answers; only the abort signal ends it.
      return new Promise<Response>((_, reject) =>
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason)),
      );
    }
    return Promise.resolve(reply);
  });
}

describe("getTryRate fallback order", () => {
  it("uses TCMB first when it publishes the currency", async () => {
    const fetcher = fakeFetch({ tcmb: TCMB });
    const rate = await getTryRate("eur", { fetcher });
    expect(rate).toMatchObject({ ok: true, currency: "EUR", tryPerUnit: 55.618, date: "2026-10-16", source: { id: "tcmb" } });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("falls back to Frankfurter for currencies TCMB does not publish", async () => {
    const fetcher = fakeFetch({ tcmb: TCMB, frankfurter: () => ok(fixture("frankfurter-czk.json")) });
    const rate = await getTryRate("CZK", { fetcher });
    expect(rate).toMatchObject({ ok: true, tryPerUnit: 2.2481, date: "2026-10-15", source: { id: "frankfurter" } });
    expect(fetcher.mock.calls[1][0]).toBe("https://api.frankfurter.dev/v1/latest?base=CZK&symbols=TRY");
  });

  it("falls back to Exchange Rate API when neither TCMB nor ECB has it", async () => {
    const fetcher = fakeFetch({ tcmb: TCMB, frankfurter: FRANKFURTER_404, erapi: () => ok(fixture("erapi-aed.json")) });
    const rate = await getTryRate("AED", { fetcher });
    expect(rate).toMatchObject({ ok: true, tryPerUnit: 13.5311, source: { id: "erapi", name: "Exchange Rate API" } });
    expect(fetcher.mock.calls.map((c) => new URL(c[0]).host)).toEqual([
      "www.tcmb.gov.tr",
      "api.frankfurter.dev",
      "open.er-api.com",
    ]);
  });

  it("skips TCMB when it is down", async () => {
    const fetcher = fakeFetch({
      tcmb: status(503),
      frankfurter: () => ok('{"amount":1,"base":"EUR","date":"2026-10-15","rates":{"TRY":55.7}}'),
    });
    expect(await getTryRate("EUR", { fetcher })).toMatchObject({ ok: true, source: { id: "frankfurter" }, tryPerUnit: 55.7 });
  });

  it("skips TCMB when it answers with something that is not the bulletin", async () => {
    const fetcher = fakeFetch({
      tcmb: () => ok("<html>Bakım</html>", "text/html"),
      frankfurter: () => ok('{"amount":1,"base":"EUR","date":"2026-10-15","rates":{"TRY":55.7}}'),
    });
    expect(await getTryRate("EUR", { fetcher })).toMatchObject({ ok: true, source: { id: "frankfurter" } });
  });
});

describe("timeouts and failures", () => {
  it("gives up on a source that does not answer in time and moves on", async () => {
    const fetcher = fakeFetch({
      tcmb: "hang",
      frankfurter: "hang",
      erapi: () => ok(fixture("erapi-aed.json")),
    });
    vi.useFakeTimers();
    let rate: Awaited<ReturnType<typeof getTryRate>> | undefined;
    void getTryRate("AED", { fetcher, timeoutMs: 4_000 }).then((r) => (rate = r));
    // Each hanging source gets exactly its 4 s, then the next one is asked.
    await vi.advanceTimersByTimeAsync(3_999);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(4_000);
    expect(rate).toMatchObject({ ok: true, source: { id: "erapi" } });
  });

  it("reports why each source failed and never invents a rate", async () => {
    const fetcher = fakeFetch({ tcmb: "hang", frankfurter: new TypeError("fetch failed"), erapi: () => ok("not json") });
    vi.useFakeTimers();
    const pending = getTryRate("EUR", { fetcher, timeoutMs: 4_000 });
    await vi.advanceTimersByTimeAsync(4_000);
    const rate = await pending;
    expect(rate.ok).toBe(false);
    if (rate.ok) return;
    expect(rate.attempts.map((a) => a.source)).toEqual(["tcmb", "frankfurter", "erapi"]);
    expect(rate.attempts[0].reason).toBe("timeout");
    expect(rate.attempts[1].reason).toBe("fetch failed");
    expect(rate).not.toHaveProperty("tryPerUnit");
  });

  it("says not found when no source publishes the currency", async () => {
    const fetcher = fakeFetch({ tcmb: TCMB, frankfurter: FRANKFURTER_404, erapi: ERAPI_UNSUPPORTED });
    const rate = await getTryRate("XXX", { fetcher });
    expect(rate).toEqual({
      ok: false,
      currency: "XXX",
      attempts: [
        { source: "tcmb", reason: "currency not published" },
        { source: "frankfurter", reason: "currency not published" },
        { source: "erapi", reason: "currency not published" },
      ],
    });
  });

  it("does not call anything for a malformed currency code", async () => {
    const fetcher = fakeFetch({});
    expect(await getTryRate("euro", { fetcher })).toEqual({ ok: false, currency: "EURO", attempts: [] });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("asks Next.js to cache each response for about six hours, with a timeout signal", async () => {
    const fetcher = fakeFetch({ tcmb: TCMB });
    await getTryRate("EUR", { fetcher });
    const init = fetcher.mock.calls[0][1];
    expect(init.next).toEqual({ revalidate: RATE_REVALIDATE_SECONDS });
    expect(RATE_REVALIDATE_SECONDS).toBe(21_600);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
