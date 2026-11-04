import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { AI_ORIGINS } from "@/lib/ai/origins";
import { IMAGE_ORIGINS, MAP_TILES_ORIGIN } from "@/lib/security/csp";
import { OFFLINE_ATTRIBUTE, PLAN_CACHE, PLAN_TITLE_HEADER, retryTarget, serviceWorkerUrl } from "./sw";

const SITE = "https://vacationist-app.vercel.app";
const source = readFileSync(path.resolve(__dirname, "../../../public/sw.js"), "utf8");

type Worker = {
  VERSION: string;
  PLAN_CACHE: string;
  TITLE_HEADER: string;
  OFFLINE_ATTRIBUTE: string;
  MEDIA_ORIGINS: string[];
  PLAN_LIMIT: number;
  MEDIA_LIMIT_BYTES: number;
  routeFor: (request: { method: string; url: string; mode: string; headers: Headers }) => string;
};

/** public/sw.js run in a bare worker-like global: its rules, without a browser. */
function loadWorker(): Worker {
  const self: Record<string, unknown> = {
    location: new URL(`${SITE}${serviceWorkerUrl("abc123")}`),
    addEventListener: () => {},
  };
  vm.runInNewContext(source, { self, URL, Headers, Response, Promise, Object, Number, String, Map, Set });
  return self.vaServiceWorker as Worker;
}
const worker = loadWorker();

const request = (url: string, init: { method?: string; mode?: string; headers?: Record<string, string> } = {}) => ({
  method: init.method ?? "GET",
  url: new URL(url, SITE).href,
  mode: init.mode ?? "cors",
  headers: new Headers(init.headers),
});
const route = (url: string, init?: Parameters<typeof request>[1]) => worker.routeFor(request(url, init));

describe("service worker", () => {
  it("names its version after the build and shares its names with the page", () => {
    expect(worker.VERSION).toBe("abc123");
    expect(worker.PLAN_CACHE).toBe(PLAN_CACHE);
    expect(worker.TITLE_HEADER).toBe(PLAN_TITLE_HEADER);
    expect(worker.OFFLINE_ATTRIBUTE).toBe(OFFLINE_ATTRIBUTE);
    expect(worker.PLAN_LIMIT).toBe(10);
    expect(worker.MEDIA_LIMIT_BYTES).toBe(50 * 1024 * 1024);
  });

  it("never handles the API, Analytics, server component requests or itself", () => {
    for (const url of ["/api/origins?q=ist", "/api/anything", "/_vercel/insights/script.js", "/_vercel/insights/view", "/sw.js?v=1"]) {
      expect(route(url), url).toBe("bypass");
      expect(route(url, { mode: "navigate" }), url).toBe("bypass");
    }
    expect(route("/plan?to=BCN&depart=2026-11-14&return=2026-11-18", { headers: { RSC: "1" } })).toBe("bypass");
    expect(route("/plan?to=BCN&_rsc=x1y2")).toBe("bypass");
  });

  it("never handles the AI providers, nor any other site", () => {
    for (const origin of Object.values(AI_ORIGINS)) {
      expect(worker.MEDIA_ORIGINS).not.toContain(origin);
      expect(route(`${origin}/v1/messages`, { method: "POST" })).toBe("bypass");
      expect(route(`${origin}/v1/models`)).toBe("bypass");
    }
    expect(route("https://example.com/image.png")).toBe("bypass");
  });

  it("handles only GET", () => {
    expect(route("/plan?to=BCN", { method: "POST", mode: "navigate" })).toBe("bypass");
    expect(route(`${MAP_TILES_ORIGIN}/planet/1/2/3.pbf`, { method: "HEAD" })).toBe("bypass");
  });

  it("saves plans with a destination and treats other pages as pages", () => {
    expect(route("/plan?to=BCN&depart=2026-11-14&return=2026-11-18", { mode: "navigate" })).toBe("plan");
    expect(route("/en/plan?to=BCN&depart=2026-11-14&return=2026-11-18", { mode: "navigate" })).toBe("plan");
    expect(route("/plan", { mode: "navigate" })).toBe("page");
    expect(route("/", { mode: "navigate" })).toBe("page");
    expect(route("/en/offline?from=%2Fplan", { mode: "navigate" })).toBe("page");
  });

  it("serves build files from the cache first and other files from the network first", () => {
    expect(route("/_next/static/chunks/0abc.js")).toBe("static");
    expect(route("/_next/static/media/fraunces.woff2")).toBe("static");
    expect(route("/vendor/maplibre/maplibre-gl-csp-worker.js")).toBe("asset");
    expect(route("/icons/icon-192.png")).toBe("asset");
    expect(route("/en/manifest.webmanifest")).toBe("asset");
    expect(route("/og/plan?to=BCN")).toBe("bypass");
  });

  it("keeps map tiles and Commons photos, the origins its own CSP lets it reach", () => {
    expect(worker.MEDIA_ORIGINS).toEqual([MAP_TILES_ORIGIN, ...IMAGE_ORIGINS]);
    expect(route(`${MAP_TILES_ORIGIN}/planet/20260101/14/8/5.pbf`)).toBe("media");
    expect(route("https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/X.jpg/500px-X.jpg")).toBe("media");
  });
});

describe("retryTarget", () => {
  it("goes back to a path on this site, otherwise home", () => {
    expect(retryTarget("?from=%2Fplan%3Fto%3DBCN", "tr")).toBe("/plan?to=BCN");
    expect(retryTarget("?from=%2Fen%2Fplan%3Fto%3DBCN", "en")).toBe("/en/plan?to=BCN");
    expect(retryTarget("", "tr")).toBe("/");
    expect(retryTarget("", "en")).toBe("/en");
    for (const from of ["https://evil.example/", "//evil.example/", "/\\evil.example/", "javascript:alert(1)"]) {
      expect(retryTarget(`?from=${encodeURIComponent(from)}`, "tr"), from).toBe("/");
    }
  });
});
