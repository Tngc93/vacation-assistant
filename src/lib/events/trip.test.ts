import { describe, expect, it } from "vitest";
import type { StoredEvent } from "./file";
import {
  approximateCaption,
  dayNotes,
  editionCaption,
  eventsInTrip,
  mastheadLine,
  monthsText,
  rangesOverlap,
  tripEventCaption,
  tripMonths,
} from "./trip";
import { EN, TR } from "@/test/i18n";

const exact = (qid: string, name: string, wikipedias: number, start: string, end: string, venue?: string): StoredEvent => ({
  qid,
  name,
  type: "festival",
  wikipedias,
  editions: [{ qid: `${qid}1`, start, end }],
  ...(venue ? { venue: { qid: "Q700887", name: venue, lat: 48.13, lon: 11.55 } } : {}),
});
const approx = (qid: string, name: string, wikipedias: number, months: number[]): StoredEvent => ({ qid, name, type: "festival", wikipedias, months });

describe("date overlap", () => {
  it("counts a partial overlap at either end", () => {
    expect(rangesOverlap({ start: "2026-09-19", end: "2026-10-04" }, { start: "2026-10-03", end: "2026-10-07" })).toBe(true);
    expect(rangesOverlap({ start: "2026-09-19", end: "2026-10-04" }, { start: "2026-09-15", end: "2026-09-19" })).toBe(true);
  });

  it("counts a single shared day, and nothing when the ranges only touch the day after", () => {
    expect(rangesOverlap({ start: "2026-11-14", end: "2026-11-14" }, { start: "2026-11-10", end: "2026-11-14" })).toBe(true);
    expect(rangesOverlap({ start: "2026-11-15", end: "2026-11-15" }, { start: "2026-11-10", end: "2026-11-14" })).toBe(false);
  });

  it("works across the new year", () => {
    expect(rangesOverlap({ start: "2026-12-28", end: "2027-01-02" }, { start: "2027-01-01", end: "2027-01-05" })).toBe(true);
    expect(tripMonths("2026-12-30", "2027-01-02")).toEqual([12, 1]);
    expect(tripMonths("2026-11-14", "2026-11-18")).toEqual([11]);
  });
});

describe("events in the trip", () => {
  const events = [
    approx("Q1", "Small fair", 6, [11]),
    exact("Q2", "Film festival", 20, "2026-11-10", "2026-11-15"),
    approx("Q3", "Big carnival", 50, [10, 11]),
    exact("Q4", "Oktoberfest", 77, "2026-11-14", "2026-11-14", "Theresienwiese"),
    exact("Q5", "Next year", 90, "2027-11-14", "2027-11-18"),
    approx("Q6", "Summer festival", 90, [7, 8]),
  ];

  it("puts exact events first, then approximate ones, each most known first", () => {
    const found = eventsInTrip(events, "2026-11-14", "2026-11-18");
    expect(found.map((f) => [f.kind, f.event.name])).toEqual([
      ["exact", "Oktoberfest"],
      ["exact", "Film festival"],
      ["approximate", "Big carnival"],
      ["approximate", "Small fair"],
    ]);
  });

  it("never falls back to months for an event with exact editions", () => {
    const withMonths = { ...exact("Q7", "Dated", 30, "2027-03-01", "2027-03-05") };
    expect(eventsInTrip([withMonths], "2026-11-14", "2026-11-18")).toEqual([]);
  });

  it("matches months over the new year", () => {
    const found = eventsInTrip([approx("Q8", "Winter market", 10, [1])], "2026-12-30", "2027-01-02");
    expect(found).toHaveLength(1);
  });
});

describe("captions", () => {
  it("writes exact dates and single days", () => {
    expect(editionCaption({ start: "2026-11-14", end: "2026-11-18" })).toBe("14 KAS – 18 KAS");
    expect(editionCaption({ start: "2026-09-19", end: "2026-10-04" })).toBe("19 EYL – 4 EKİ");
    expect(editionCaption({ start: "2026-02-03", end: "2026-02-03" })).toBe("3 ŞUB");
  });

  it("writes months as runs, wrapping over the new year", () => {
    expect(monthsText([9, 10], TR)).toBe("EYLÜL–EKİM");
    expect(monthsText([11], TR)).toBe("KASIM");
    expect(monthsText([1, 12], TR)).toBe("ARALIK–OCAK");
    expect(monthsText([2, 6, 7], TR)).toBe("ŞUBAT, HAZİRAN–TEMMUZ");
    expect(approximateCaption([11], TR)).toBe("GENELDE KASIM · TARİHİ DOĞRULA");
    expect(monthsText([1, 12], EN)).toBe("DECEMBER–JANUARY");
    expect(approximateCaption([11], EN)).toBe("USUALLY NOVEMBER · CHECK THE DATES");
    expect(editionCaption({ start: "2026-11-14", end: "2026-11-18" }, "en-GB")).toBe("14 NOV – 18 NOV");
  });

  it("labels approximate events as usual, never as dates", () => {
    const [item] = eventsInTrip([approx("Q3", "Big carnival", 50, [9, 10])], "2026-09-20", "2026-09-24");
    expect(tripEventCaption(item, TR)).toBe("GENELDE EYLÜL–EKİM · TARİHİ DOĞRULA");
  });
});

describe("masthead line", () => {
  it("names the most important exact event", () => {
    const found = eventsInTrip(
      [exact("Q2", "Film festivali", 20, "2026-11-10", "2026-11-15"), exact("Q4", "Oktoberfest", 77, "2026-11-14", "2026-11-20")],
      "2026-11-14",
      "2026-11-18",
    );
    expect(mastheadLine(found, TR)).toBe("BU TARİHLERDE: OKTOBERFEST");
  });

  it("is empty with approximate events only", () => {
    expect(mastheadLine(eventsInTrip([approx("Q3", "Big carnival", 50, [11])], "2026-11-14", "2026-11-18"), TR)).toBeNull();
    expect(mastheadLine([], TR)).toBeNull();
  });
});

describe("day notes", () => {
  it("marks only the days inside an exact event, with its venue", () => {
    const found = eventsInTrip(
      [exact("Q4", "Oktoberfest", 77, "2026-10-01", "2026-10-04", "Theresienwiese"), approx("Q3", "Big carnival", 50, [10])],
      "2026-10-03",
      "2026-10-06",
    );
    expect(dayNotes(found, "2026-10-03", "2026-10-06", TR)).toEqual({
      "2026-10-03": ["Bugün şehirde: Oktoberfest · Theresienwiese"],
      "2026-10-04": ["Bugün şehirde: Oktoberfest · Theresienwiese"],
    });
  });

  it("writes the name alone without a venue", () => {
    const found = eventsInTrip([exact("Q2", "Berlinale", 40, "2027-02-11", "2027-02-21")], "2027-02-20", "2027-02-22");
    expect(dayNotes(found, "2027-02-20", "2027-02-22", TR)["2027-02-21"]).toEqual(["Bugün şehirde: Berlinale"]);
  });
});
