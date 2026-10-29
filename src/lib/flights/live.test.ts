import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { describe, expect, it } from "vitest";
import { findDestination } from "@/data/destinations";
import { resolveOrigin } from "@/lib/origins/data";
import { addDays } from "@/lib/search/dates";
import type { Fetcher } from "./client";
import { searchFlights } from "./search";

/**
 * Live check against the real Travelpayouts price API: departures from London, Berlin, İstanbul and an old Ankara
 * link return cached tickets. Runs only with a token (TRAVELPAYOUTS_TOKEN, or .env.local) and never in CI; otherwise skipped.
 * Never prints the token. The trip dates follow the real calendar, unlike every other test.
 */
const local = existsSync(".env.local") ? parseEnv(readFileSync(".env.local", "utf8")) : {};
const token = (process.env.TRAVELPAYOUTS_TOKEN ?? local.TRAVELPAYOUTS_TOKEN ?? "").trim();
const network = (globalThis as { __vaNetworkFetch?: typeof fetch }).__vaNetworkFetch;
const live = Boolean(token) && !process.env.CI && !token.startsWith("ci-canary") && network !== undefined;

describe.skipIf(!live)("Travelpayouts live (token only, not in CI)", () => {
  const today = new Date().toISOString().slice(0, 10);
  const depart = addDays(today, 35);
  const ret = addDays(depart, 4);

  it.each([
    ["LON", "BCN"],
    ["BER", "ROM"],
    ["IST", "PAR"],
  ])("%s → %s returns tickets grouped by the origin's airports", async (from, to) => {
    const origin = resolveOrigin(from);
    expect(origin.code).toBe(from);
    const result = await searchFlights(
      { origin, destination: findDestination(to)!, depart, return: ret, pax: 1, direct: false, today },
      { token, fixture: false, fetcher: network as Fetcher, partner: { marker: null, trs: null } },
    );
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const tickets = result.groups.flatMap((g) => g.tickets);
    expect(tickets.length).toBeGreaterThan(0);
    const airports = origin.airports.map((a) => a.code);
    expect(tickets.every((t) => airports.includes(t.originAirport))).toBe(true);
    console.log(`${from}→${to} ${depart}/${ret}: ${result.groups.map((g) => `${g.airport} ${g.outcome} ${g.tickets.length}`).join(", ")}`);
  }, 60_000);

  // An old Ankara link (?from=ESB), resolved as the plan page does. Ankara's cache is thin (2026-10-29: Amsterdam,
  // Barcelona, Berlin and Rome empty), so one of several routes must have tickets.
  it("an old Ankara link (ESB) opens Ankara and finds tickets on one of its usual routes", async () => {
    const origin = resolveOrigin("ESB");
    expect(origin).toMatchObject({ code: "ESB", name: "Ankara" });
    const found: string[] = [];
    for (const to of ["LON", "PAR", "BCN", "AMS"]) {
      const result = await searchFlights(
        { origin, destination: findDestination(to)!, depart, return: ret, pax: 1, direct: false, today },
        { token, fixture: false, fetcher: network as Fetcher, partner: { marker: null, trs: null } },
      );
      expect(result.status).toBe("ok");
      const n = result.status === "ok" ? result.groups.flatMap((g) => g.tickets).length : 0;
      if (n) found.push(`${to} ${n}`);
    }
    console.log(`ESB→ ${depart}/${ret}: ${found.join(", ") || "nothing cached"}`);
    expect(found.length).toBeGreaterThan(0);
  }, 60_000);
});

