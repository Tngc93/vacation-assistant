import { afterEach, describe, expect, it, vi } from "vitest";
import { getFixtureRate, rateFixturesEnabled, SAMPLE_SOURCE_NAME } from "./fixtures";

describe("sample rates (VA_RATES_FIXTURES=1)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("are on only when asked for, and never on Vercel", () => {
    vi.stubEnv("VA_RATES_FIXTURES", "");
    expect(rateFixturesEnabled()).toBe(false);
    vi.stubEnv("VA_RATES_FIXTURES", "1");
    vi.stubEnv("VERCEL", "");
    expect(rateFixturesEnabled()).toBe(true);
    vi.stubEnv("VERCEL", "1");
    expect(rateFixturesEnabled()).toBe(false);
  });

  it("come from the saved TCMB bulletin, named as sample data, with no network", async () => {
    vi.stubEnv("VA_OFFLINE", "1");
    expect(await getFixtureRate("EUR")).toMatchObject({ ok: true, tryPerUnit: 55.618, date: "2026-10-16", source: { id: "tcmb", name: SAMPLE_SOURCE_NAME } });
    // GBP is not in the bulletin: missing, as with a real outage.
    expect((await getFixtureRate("GBP")).ok).toBe(false);
  });
});
