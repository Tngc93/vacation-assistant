import { describe, expect, it } from "vitest";
import { buildIcs, escapeText, foldLine, localToInstant, offsetMinutes } from "./ics";
import { buildItinerary } from "./plan";
import { EVENING, SIGHTS } from "./testCity";

const NOW = new Date("2026-10-17T09:00:00Z");
const plan = buildItinerary({ depart: "2026-11-14", return: "2026-11-18", timeZone: "Europe/Madrid", flight: null, daytime: SIGHTS, evening: EVENING, skip: [] });

/** A strict-enough RFC 5545 check: CRLF, folding, nesting, required properties, TZID with a VTIMEZONE. */
function validate(ics: string) {
  const errors: string[] = [];
  if (!ics.endsWith("\r\n")) errors.push("no final CRLF");
  if (/[^\r]\n/.test(ics)) errors.push("bare LF");
  const physical = ics.split("\r\n").slice(0, -1);
  for (const line of physical) if (new TextEncoder().encode(line).length > 75) errors.push(`line over 75 octets: ${line}`);
  const lines = ics.replace(/\r\n /g, "").split("\r\n").filter(Boolean);
  const stack: string[] = [];
  const events: Array<Record<string, string>> = [];
  let current: Record<string, string> | null = null;
  const tzids = new Set<string>();
  const referenced = new Set<string>();
  for (const line of lines) {
    const [, name, params = "", value] = /^([A-Z-]+)((?:;[^:]+)?):(.*)$/.exec(line) ?? [];
    if (!name) {
      errors.push(`bad line: ${line}`);
      continue;
    }
    if (name === "BEGIN") {
      stack.push(value);
      if (value === "VEVENT") current = {};
    } else if (name === "END") {
      if (stack.pop() !== value) errors.push(`END:${value} out of order`);
      if (value === "VEVENT" && current) {
        events.push(current);
        current = null;
      }
    } else if (current) {
      current[name] = value;
      const tz = /TZID=([^;:]+)/.exec(params)?.[1];
      if (tz) referenced.add(tz);
    } else if (name === "TZID") tzids.add(value);
  }
  if (stack.length) errors.push("unclosed components");
  if (!lines.includes("VERSION:2.0") || !lines.some((l) => l.startsWith("PRODID:"))) errors.push("missing VERSION/PRODID");
  for (const e of events) {
    for (const key of ["UID", "DTSTAMP", "DTSTART", "DTEND", "SUMMARY"]) if (!e[key]) errors.push(`event without ${key}`);
    if (!/^\d{8}T\d{6}Z$/.test(e.DTSTAMP ?? "")) errors.push("DTSTAMP not UTC");
    if (!/^\d{8}T\d{6}$/.test(e.DTSTART ?? "")) errors.push(`bad DTSTART ${e.DTSTART}`);
  }
  for (const tz of referenced) if (!tzids.has(tz)) errors.push(`TZID ${tz} has no VTIMEZONE`);
  return { errors, events, lines };
}

describe("buildIcs", () => {
  it("is a valid calendar with one event per stop in the city's time zone", () => {
    const ics = buildIcs(plan, { cityName: "Barselona", now: NOW });
    const { errors, events, lines } = validate(ics);
    expect(errors).toEqual([]);
    const stops = plan.days.flatMap((d) => d.stops);
    expect(events).toHaveLength(stops.length);
    expect(new Set(events.map((e) => e.UID)).size).toBe(events.length);
    const first = plan.days.find((d) => d.stops.length)!;
    expect(lines).toContain(`DTSTART;TZID=Europe/Madrid:${first.date.replaceAll("-", "")}T${first.stops[0].start.replace(":", "")}00`);
    expect(lines).toContain("TZOFFSETTO:+0100");
    expect(events[0].DESCRIPTION).toContain("OpenStreetMap: https://www.openstreetmap.org/node/");
    expect(events[0].DESCRIPTION).toContain("Adres: Street");
    expect(events[0].DTSTAMP).toBe("20261017T090000Z");
  });

  it("is reproducible for the same plan and time", () => {
    expect(buildIcs(plan, { cityName: "Barselona", now: NOW })).toBe(buildIcs(plan, { cityName: "Barselona", now: NOW }));
  });

  it("escapes text and folds long lines without splitting characters", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\;c\\\\d\\ne");
    const long = `SUMMARY:${"Çarşı ".repeat(30)}`;
    const folded = foldLine(long);
    for (const part of folded.split("\r\n")) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(long);
  });

  it("describes a DST change during the trip", () => {
    // Clocks go back in Madrid at 03:00 on Sunday 25 Oct 2026.
    expect(offsetMinutes("Europe/Madrid", localToInstant("2026-10-24", "12:00", "Europe/Madrid"))).toBe(120);
    expect(offsetMinutes("Europe/Madrid", localToInstant("2026-10-26", "12:00", "Europe/Madrid"))).toBe(60);
    const trip = buildItinerary({ depart: "2026-10-23", return: "2026-10-27", timeZone: "Europe/Madrid", flight: null, daytime: SIGHTS, evening: EVENING, skip: [] });
    const { errors, lines } = validate(buildIcs(trip, { cityName: "Barselona", now: NOW }));
    expect(errors).toEqual([]);
    const i = lines.indexOf("DTSTART:20261025T030000");
    expect(i).toBeGreaterThan(0);
    expect(lines.slice(i - 1, i + 4)).toEqual(["BEGIN:STANDARD", "DTSTART:20261025T030000", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "END:STANDARD"]);
  });

  it("keeps local wall times right in other zones (Tokyo has no DST)", () => {
    const tokyo = buildItinerary({ depart: "2026-11-14", return: "2026-11-16", timeZone: "Asia/Tokyo", flight: null, daytime: SIGHTS, evening: EVENING, skip: [] });
    const { errors, lines } = validate(buildIcs(tokyo, { cityName: "Tokyo", now: NOW }));
    expect(errors).toEqual([]);
    expect(lines.filter((l) => l.startsWith("TZOFFSETTO:"))).toEqual(["TZOFFSETTO:+0900"]);
  });
});
