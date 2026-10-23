import { describe, expect, it } from "vitest";
import { analyticsEnabled, pathOnly } from "./analytics";

describe("pathOnly (Vercel Web Analytics beforeSend)", () => {
  it("sends a plan link as /plan: no city, dates, budget, skipped stops or AI edits", () => {
    const url =
      "https://vacationist-app.vercel.app/plan?to=BCN&depart=2026-11-14&return=2026-11-18&from=ESB&pax=2" +
      "&flight=abc&stay=250000&daily=150000&cur=EUR&skip=w1,n2&ai=1:w3&edit=remove-w4&wf=1234&wfs=Pegasus#ucuslar";
    expect(pathOnly({ type: "pageview", url })).toEqual({ type: "pageview", url: "https://vacationist-app.vercel.app/plan" });
  });

  it("keeps every path as it is", () => {
    for (const path of ["/", "/plan", "/styleguide", "/bu-sayfa-yok"]) {
      expect(pathOnly({ type: "pageview", url: `https://vacationist-app.vercel.app${path}?x=1` })?.url).toBe(
        `https://vacationist-app.vercel.app${path}`,
      );
    }
  });

  it("drops anything but a page view: the site sends no custom events", () => {
    expect(pathOnly({ type: "event", url: "https://vacationist-app.vercel.app/plan?to=BCN" })).toBeNull();
  });
});

describe("analyticsEnabled", () => {
  it("is on only for a production build on the production deployment", () => {
    expect(analyticsEnabled({ NODE_ENV: "production", VERCEL_ENV: "production" })).toBe(true);
  });

  it("is off in development, on preview deployments, in a local build and in tests", () => {
    expect(analyticsEnabled({ NODE_ENV: "development" })).toBe(false);
    expect(analyticsEnabled({ NODE_ENV: "development", VERCEL_ENV: "development" })).toBe(false);
    // `next dev` with a .env.local pulled from production still sends nothing.
    expect(analyticsEnabled({ NODE_ENV: "development", VERCEL_ENV: "production" })).toBe(false);
    expect(analyticsEnabled({ NODE_ENV: "production", VERCEL_ENV: "preview" })).toBe(false);
    expect(analyticsEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(analyticsEnabled({ NODE_ENV: "test" })).toBe(false);
    expect(analyticsEnabled()).toBe(false);
  });
});
