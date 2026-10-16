import { describe, expect, it } from "vitest";
import { editHref, parseSearch, planHref, serializeSearch, type SearchState } from "./params";

const TODAY = "2026-10-16";
const VALID: SearchState = { from: "IST", to: "BCN", depart: "2026-11-14", return: "2026-11-18", pax: 2 };
const QUERY = "from=IST&to=BCN&depart=2026-11-14&return=2026-11-18&pax=2";

const parse = (query: string) => parseSearch(new URLSearchParams(query), TODAY);

describe("serialize and parse", () => {
  it("writes the documented URL format", () => {
    expect(serializeSearch(VALID)).toBe(QUERY);
    expect(planHref(VALID)).toBe(`/plan?${QUERY}`);
    expect(editHref(VALID)).toBe(`/?${QUERY}#arama`);
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

describe("invalid or missing params", () => {
  it("reports every missing field and keeps a usable draft", () => {
    const result = parse("");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.draft).toEqual({ from: "IST" });
    expect(result.issues.map((i) => i.field)).toEqual(["to", "depart", "return", "pax"]);
  });

  it("keeps the valid fields and flags the invalid ones", () => {
    const result = parse("from=XYZ&to=QQQ&depart=2026-11-14&return=2026-11-18&pax=12");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.draft).toEqual({ from: "IST", depart: "2026-11-14", return: "2026-11-18" });
    expect(result.issues.map((i) => i.field)).toEqual(["from", "to", "pax"]);
  });

  it.each(["0", "10", "-1", "2.5", "abc", "1e1"])("rejects pax=%s", (pax) => {
    const result = parse(`to=BCN&depart=2026-11-14&return=2026-11-18&pax=${pax}`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((i) => i.field)).toEqual(["pax"]);
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
