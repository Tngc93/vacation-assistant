import { describe, expect, it } from "vitest";
import { editHref, hasRouteParams, parseSearch, planHref, serializeSearch, writeTripParams, type SearchState } from "./params";

const TODAY = "2026-10-16";
const VALID: SearchState = { from: "IST", to: "BCN", depart: "2026-11-14", return: "2026-11-18", pax: 2 };
// The origin is the default (İstanbul) and is left out; two people are written.
const QUERY = "to=BCN&depart=2026-11-14&return=2026-11-18&pax=2";
const LEGACY = "from=IST&to=BCN&depart=2026-11-14&return=2026-11-18&pax=2";

const parse = (query: string) => parseSearch(new URLSearchParams(query), TODAY);

describe("serialize and parse", () => {
  it("writes the documented URL format", () => {
    expect(serializeSearch(VALID)).toBe(QUERY);
    expect(planHref(VALID)).toBe(`/plan?${QUERY}`);
    expect(editHref(VALID)).toBe(`/?${QUERY}#arama`);
  });

  it("leaves the default origin and one person out of the link", () => {
    expect(planHref({ ...VALID, pax: 1 })).toBe("/plan?to=BCN&depart=2026-11-14&return=2026-11-18");
    expect(serializeSearch({ ...VALID, from: "ESB" })).toBe("from=ESB&to=BCN&depart=2026-11-14&return=2026-11-18&pax=2");
    expect(editHref({ to: "BCN", depart: "2026-11-14", return: "2026-11-18", from: "IST", pax: 1 })).toBe(
      "/?to=BCN&depart=2026-11-14&return=2026-11-18#arama",
    );
  });

  it("opens a link without from and pax from İstanbul (IST + SAW) for one person", () => {
    expect(parse("to=BCN&depart=2026-11-14&return=2026-11-18")).toEqual({ ok: true, value: { ...VALID, pax: 1 } });
  });

  it("opens an older link with from and pax as the same plan", () => {
    expect(parse(LEGACY)).toEqual({ ok: true, value: VALID });
    expect(parse("from=ESB&to=BCN&depart=2026-11-14&return=2026-11-18&pax=1")).toEqual({
      ok: true,
      value: { ...VALID, from: "ESB", pax: 1 },
    });
  });

  it.each<SearchState>([
    VALID,
    { from: "ESB", to: "LON", depart: TODAY, return: "2026-10-17", pax: 1 },
    { from: "IST", to: "NYC", depart: "2027-09-01", return: "2027-10-01", pax: 9 },
  ])("round-trips %o", (state) => {
    expect(parse(serializeSearch(state))).toEqual({ ok: true, value: state });
  });

  it("accepts a Next.js searchParams object and takes the first of repeated keys", () => {
    const result = parseSearch(
      { from: "IST", to: ["BCN", "PAR"], depart: "2026-11-14", return: "2026-11-18", pax: "2" },
      TODAY,
    );
    expect(result).toEqual({ ok: true, value: VALID });
  });

  it("normalises letter case in codes", () => {
    expect(parse("from=esb&to=bcn&depart=2026-11-14&return=2026-11-18&pax=2")).toEqual({
      ok: true,
      value: { ...VALID, from: "ESB" },
    });
  });

  it("defaults the origin to Istanbul", () => {
    expect(parse("to=BCN&depart=2026-11-14&return=2026-11-18&pax=2")).toEqual({ ok: true, value: VALID });
  });
});

describe("hasRouteParams", () => {
  it("looks only at the destination and the dates", () => {
    expect(hasRouteParams(new URLSearchParams("from=ESB&pax=2"))).toBe(false);
    expect(hasRouteParams(new URLSearchParams("to=BCN"))).toBe(true);
    expect(hasRouteParams({ depart: "2026-11-14" })).toBe(true);
    expect(hasRouteParams({ to: " " })).toBe(false);
  });
});

describe("writeTripParams", () => {
  const PLAN = "to=BCN&depart=2026-11-14&return=2026-11-18&cats=see%2Cmuseum&skip=n1&ai=w1&edit=x&stay=1200&daily=80&cur=EUR";
  const write = (query: string, change: Parameters<typeof writeTripParams>[1]) =>
    Object.fromEntries(writeTripParams(new URLSearchParams(query), change));

  it("sets a new origin and keeps every other param", () => {
    expect(write(PLAN, { from: "ESB" })).toEqual({ ...Object.fromEntries(new URLSearchParams(PLAN)), from: "ESB" });
  });

  it("drops the budget's flight when the origin changes, since it left from the other city", () => {
    const query = `${PLAN}&flight=IST-TK1853-202611140705-202611181010&wf=4200&wfs=example.com`;
    const next = write(query, { from: "ESB" });
    expect(next.flight).toBeUndefined();
    expect(next.wf).toBeUndefined();
    expect(next.wfs).toBeUndefined();
    expect(next.stay).toBe("1200");
    // The same origin again changes nothing.
    expect(write(`from=ESB&${query}`, { from: "ESB" }).flight).toBe("IST-TK1853-202611140705-202611181010");
  });

  it("writes the number of people and keeps the flight", () => {
    const next = write(`${PLAN}&flight=IST-TK1853-202611140705-202611181010`, { pax: 3 });
    expect(next.pax).toBe("3");
    expect(next.flight).toBe("IST-TK1853-202611140705-202611181010");
  });

  it("removes the params again for the defaults", () => {
    expect(write(`from=ESB&pax=4&${PLAN}`, { from: "IST", pax: 1 })).toEqual(Object.fromEntries(new URLSearchParams(PLAN)));
  });
});

describe("invalid or missing params", () => {
  it("reports every missing field and keeps a usable draft", () => {
    const result = parse("");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.draft).toEqual({ from: "IST", pax: 1 });
    expect(result.issues.map((i) => i.field)).toEqual(["to", "depart", "return"]);
  });

  it("keeps the valid fields and flags only the route", () => {
    const result = parse("from=XYZ&to=QQQ&depart=2026-11-14&return=2026-11-18&pax=12");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.draft).toEqual({ from: "IST", pax: 1, depart: "2026-11-14", return: "2026-11-18" });
    expect(result.issues.map((i) => i.field)).toEqual(["to"]);
  });

  it.each(["0", "10", "-1", "2.5", "abc", "1e1"])("falls back to one person for pax=%s", (pax) => {
    expect(parse(`to=BCN&depart=2026-11-14&return=2026-11-18&pax=${pax}`)).toEqual({ ok: true, value: { ...VALID, pax: 1 } });
  });

  it("falls back to İstanbul for an unknown origin", () => {
    expect(parse("from=SAW&to=BCN&depart=2026-11-14&return=2026-11-18&pax=2")).toEqual({ ok: true, value: VALID });
  });

  it("drops both dates when the departure is in the past", () => {
    const result = parse("to=BCN&depart=2026-10-01&return=2026-10-05&pax=2");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.draft).toEqual({ from: "IST", to: "BCN", pax: 2 });
    expect(result.issues.map((i) => i.field)).toEqual(["depart"]);
  });

  it("drops only the return when the stay is too long", () => {
    const result = parse("to=BCN&depart=2026-11-01&return=2026-12-15&pax=2");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.draft.depart).toBe("2026-11-01");
    expect(result.draft.return).toBeUndefined();
    expect(result.issues).toEqual([{ field: "return", message: "Konaklama en fazla 30 gece olabilir." }]);
  });

  it("rejects impossible calendar dates", () => {
    const result = parse("to=BCN&depart=2027-02-30&return=2027-03-02&pax=2");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((i) => i.field)).toEqual(["depart"]);
  });

  it.each([
    "to=%E0%A4%A&pax=%%%",
    "depart=<script>&return=null&pax=Infinity",
    "to=&depart=&return=&pax=",
    "from[]=IST&to[]=BCN",
  ])("never throws on %s", (query) => {
    expect(() => parse(query)).not.toThrow();
    expect(parse(query).ok).toBe(false);
  });
});
