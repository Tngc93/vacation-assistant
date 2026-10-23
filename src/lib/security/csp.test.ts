import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";
import { AI_ORIGINS } from "../ai/origins";
import { OPENFREEMAP_STYLE_URL } from "../places/mapStyle";
import { contentSecurityPolicy, MAP_TILES_ORIGIN } from "./csp";

const directive = (csp: string, name: string) => csp.split("; ").find((d) => d.startsWith(`${name} `))!.split(" ").slice(1);

describe("Content-Security-Policy", () => {
  it("lets the page connect only to our origin, the map tiles and the three AI providers", () => {
    const csp = contentSecurityPolicy({ dev: false });
    expect(directive(csp, "connect-src")).toEqual(["'self'", "https://tiles.openfreemap.org", ...Object.values(AI_ORIGINS)]);
    expect(MAP_TILES_ORIGIN).toBe(new URL(OPENFREEMAP_STYLE_URL).origin);
    expect(directive(csp, "script-src")).not.toContain("'unsafe-eval'");
    expect(directive(csp, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(csp, "object-src")).toEqual(["'none'"]);
  });

  it("opens no origin for Vercel Web Analytics: its script and beacon live under our own /_vercel/insights", () => {
    const csp = contentSecurityPolicy({ dev: false });
    expect(directive(csp, "script-src")).toEqual(["'self'", "'unsafe-inline'"]);
    expect(directive(csp, "connect-src")).toContain("'self'");
    expect(csp).not.toMatch(/vercel/i);
  });

  it("allows eval and the reload socket only in development", () => {
    const dev = contentSecurityPolicy({ dev: true });
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(directive(dev, "connect-src")).toContain("ws:");
  });

  it("is sent with every page", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toEqual([
      { source: "/:path*", headers: [{ key: "Content-Security-Policy", value: expect.stringContaining("connect-src 'self'") }] },
    ]);
  });
});
