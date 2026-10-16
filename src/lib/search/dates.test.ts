import { describe, expect, it } from "vitest";
import { addDays, addMonths, checkTripDates, daysBetween, isIsoDate, latestTripDate, todayInIstanbul } from "./dates";

const TODAY = "2026-10-16";

describe("date helpers", () => {
  it("accepts only real ISO calendar dates", () => {
    expect(isIsoDate("2026-11-14")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("14.11.2026")).toBe(false);
    expect(isIsoDate("2026-11-14T00:00")).toBe(false);
  });

  it("adds days and months across boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addMonths("2026-10-16", 12)).toBe("2027-10-16");
    expect(addMonths("2027-01-31", 1)).toBe("2027-02-28");
    expect(daysBetween("2026-11-14", "2026-11-18")).toBe(4);
  });

  it("reads today in Istanbul time", () => {
    expect(todayInIstanbul(new Date("2026-10-16T20:59:00Z"))).toBe("2026-10-16");
    expect(todayInIstanbul(new Date("2026-10-16T21:00:00Z"))).toBe("2026-10-17");
  });
});

describe("trip date rules", () => {
  const issuesFor = (depart: string, ret: string) => checkTripDates(depart, ret, TODAY).map((i) => i.field);

  it("accepts a normal trip, including leaving today", () => {
    expect(issuesFor("2026-11-14", "2026-11-18")).toEqual([]);
    expect(issuesFor(TODAY, "2026-10-17")).toEqual([]);
  });

  it("rejects past departures", () => {
    expect(issuesFor("2026-10-15", "2026-10-20")).toEqual(["depart"]);
  });

  it("requires the return to be after the departure", () => {
    expect(issuesFor("2026-11-14", "2026-11-14")).toEqual(["return"]);
    expect(issuesFor("2026-11-14", "2026-11-10")).toEqual(["return"]);
  });

  it("allows at most 30 nights", () => {
    expect(issuesFor("2026-11-01", addDays("2026-11-01", 30))).toEqual([]);
    expect(issuesFor("2026-11-01", addDays("2026-11-01", 31))).toEqual(["return"]);
  });

  it("allows dates at most 12 months ahead", () => {
    const latest = latestTripDate(TODAY);
    expect(latest).toBe("2027-10-16");
    expect(issuesFor(addDays(latest, -2), latest)).toEqual([]);
    expect(issuesFor(addDays(latest, 1), addDays(latest, 3))).toEqual(["depart"]);
    expect(issuesFor(addDays(latest, -1), addDays(latest, 1))).toEqual(["return"]);
  });
});
