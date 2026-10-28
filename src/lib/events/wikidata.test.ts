import { describe, expect, it } from "vitest";
import {
  classifyCandidates,
  editionsInWindow,
  isElsewhere,
  isTravelling,
  MIN_EVENT_WIKIPEDIAS,
  parseClasses,
  parseDetails,
  parseEditions,
  rankEvents,
  toStoredEvent,
  type RawEvent,
} from "./wikidata";

const uri = (q: string) => ({ value: `http://www.wikidata.org/entity/${q}` });
const rows = (bindings: object[]) => ({ results: { bindings } });

describe("classes and candidates", () => {
  const classes = parseClasses(
    rows([
      { class: uri("Q132241"), root: uri("Q132241") },
      { class: uri("Q13930359"), root: uri("Q132241") }, // folk festival
      { class: uri("Q220505"), root: uri("Q220505") },
      { class: uri("Q220505"), root: uri("Q132241") },
      { class: uri("Q27787439"), root: uri("Q27968055") }, // film festival edition
      { class: uri("Q27787439"), root: uri("Q132241") },
      { class: uri("Q57305"), root: uri("Q57305") }, // trade fair
      { class: uri("Q57305"), root: uri("Q288514") },
    ]),
  );

  it("types each candidate by its most specific listed class, and drops editions and trade fairs", () => {
    const found = classifyCandidates(
      rows([
        { e: uri("Q102400"), types: { value: "Q13930359" } },
        { e: uri("Q130871"), types: { value: "Q220505 Q11483816" } },
        { e: uri("Q117178653"), types: { value: "Q27787439" } },
        { e: uri("Q540720"), types: { value: "Q57305" } },
        { e: uri("Q64"), types: { value: "Q515" } },
      ]),
      classes,
    );
    expect([...found]).toEqual([
      ["Q102400", "festival"],
      ["Q130871", "film"],
    ]);
  });
});

describe("details", () => {
  it("reads months (P2922, P837 and the month of a P837 day), websites, photos and venues", () => {
    const details = parseDetails(
      rows([
        { e: uri("Q102400"), month: uri("Q124") },
        { e: uri("Q102400"), month: uri("Q123") },
        { e: uri("Q102400"), month: uri("Q123") },
        { e: uri("Q102400"), site: { value: "http://www.oktoberfest.de/" } },
        { e: uri("Q102400"), site: { value: "https://www.oktoberfest.de/" } },
        { e: uri("Q102400"), img: { value: "http://commons.wikimedia.org/wiki/Special:FilePath/Oktoberfest%202023.jpg" } },
        { e: uri("Q102400"), venue: uri("Q700887"), venueCoord: { value: "Point(11.549 48.131)" } },
        { e: uri("Q5464854"), adult: uri("Q190845") },
      ]),
    );
    expect(details.get("Q5464854")?.adult).toBe(true);
    expect(details.get("Q102400")?.adult).toBeUndefined();
    expect(details.get("Q102400")).toEqual({
      months: [9, 10],
      websites: ["https://www.oktoberfest.de/", "http://www.oktoberfest.de/"],
      files: ["Oktoberfest 2023.jpg"],
      venues: [{ qid: "Q700887", lat: 48.131, lon: 11.549 }],
      places: [],
      countries: [],
    });
  });
});

describe("travelling events", () => {
  const edinburgh = { lat: 55.9533, lon: -3.1883, radiusKm: 2 };
  it("leaves out an event held somewhere far from the city too", () => {
    // The Royal National Mod: Edinburgh one year, Skye another.
    expect(isTravelling({ places: [{ lat: 55.9533, lon: -3.1883 }, { lat: 57.27, lon: -6.2 }] }, edinburgh)).toBe(true);
    expect(isTravelling({ places: [{ lat: 55.9486, lon: -3.1999 }] }, edinburgh)).toBe(false);
    expect(isTravelling({ places: [] }, edinburgh)).toBe(false);
  });
});

describe("events of another country", () => {
  it("leaves out an event whose countries do not include the city's", () => {
    expect(isElsewhere({ countries: [""] }, "IT")).toBe(true); // Larentalia: Ancient Rome
    expect(isElsewhere({ countries: ["RS", "BA", "ME"] }, "BA")).toBe(false);
    expect(isElsewhere({ countries: [] }, "IT")).toBe(false);
  });
});

describe("editions", () => {
  const dated = (series: string, ed: string, fields: Record<string, string>) => ({
    series: uri(series),
    ed: uri(ed),
    ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { value: v }])),
  });

  it("keeps only day-precise dates: a start and an end, or one point in time", () => {
    const editions = parseEditions(
      rows([
        dated("Q130871", "Q1", { start: "2027-02-11T00:00:00Z", startPrec: "11", end: "2027-02-21T00:00:00Z", endPrec: "11" }),
        dated("Q130871", "Q2", { at: "2027-01-01T00:00:00Z", atPrec: "9" }), // a year only
        dated("Q130871", "Q3", { start: "2027-06-01T00:00:00Z", startPrec: "11" }), // no end
        dated("Q130871", "Q4", { at: "2027-03-07T00:00:00Z", atPrec: "11" }),
        dated("Q130871", "Q5", { start: "2027-05-01T00:00:00Z", startPrec: "10", end: "2027-05-31T00:00:00Z", endPrec: "10" }), // months
      ]),
    );
    expect(editions.get("Q130871")).toEqual([
      { qid: "Q1", start: "2027-02-11", end: "2027-02-21" },
      { qid: "Q4", start: "2027-03-07", end: "2027-03-07" },
    ]);
  });

  it("keeps editions from today up to 18 months ahead, earliest first", () => {
    const list = [
      { qid: "Q9", start: "2028-06-01", end: "2028-06-03" },
      { qid: "Q2", start: "2027-02-11", end: "2027-02-21" },
      { qid: "Q1", start: "2026-10-20", end: "2026-10-30" },
      { qid: "Q0", start: "2026-02-11", end: "2026-02-21" },
    ];
    expect(editionsInWindow(list, "2026-10-28").map((e) => e.qid)).toEqual(["Q1", "Q2"]);
  });
});

describe("stored events", () => {
  const raw = (over: Partial<RawEvent>): RawEvent => ({
    qid: "Q102400",
    type: "festival",
    labels: { tr: "Oktoberfest", en: "Oktoberfest" },
    wikipedias: 77,
    details: { months: [9, 10], websites: ["https://www.oktoberfest.de/"], files: [], venues: [], places: [], countries: [] },
    editions: [],
    ...over,
  });

  it("drops events under the sitelink threshold and keeps those at it", () => {
    expect(toStoredEvent(raw({ wikipedias: MIN_EVENT_WIKIPEDIAS - 1 }), "2026-10-28")).toBeNull();
    expect(toStoredEvent(raw({ wikipedias: MIN_EVENT_WIKIPEDIAS }), "2026-10-28")).not.toBeNull();
    expect(toStoredEvent(raw({ wikipedias: 3 }), "2026-10-28", 3)).not.toBeNull();
  });

  it("stores months only when there is no exact edition in the window", () => {
    expect(toStoredEvent(raw({}), "2026-10-28")).toMatchObject({ months: [9, 10], website: "https://www.oktoberfest.de/" });
    const withEdition = toStoredEvent(raw({ editions: [{ qid: "Q1", start: "2027-09-18", end: "2027-10-03" }] }), "2026-10-28");
    expect(withEdition).toMatchObject({ editions: [{ start: "2027-09-18", end: "2027-10-03" }] });
    expect(withEdition).not.toHaveProperty("months");
  });

  it("never stores an event without a date: no edition in the window and no months", () => {
    const pastOnly = raw({ details: { months: [], websites: [], files: [], venues: [], places: [], countries: [] }, editions: [{ qid: "Q1", start: "2025-09-20", end: "2025-10-05" }] });
    expect(toStoredEvent(pastOnly, "2026-10-28")).toBeNull();
  });

  it("leaves out adult content, by type, subject or genre and by name", () => {
    const details = { months: [9], websites: [], files: [], venues: [], places: [], countries: [] };
    // Folsom Europe: a street fair whose main subject (P921) is BDSM.
    expect(toStoredEvent(raw({ labels: { en: "Folsom Europe" }, details: { ...details, adult: true } }), "2026-10-28")).toBeNull();
    // The Brussels International Festival of Eroticism: typed only as a film festival.
    expect(toStoredEvent(raw({ labels: { en: "Brussels International Festival of Eroticism" }, details }), "2026-10-28")).toBeNull();
    expect(toStoredEvent(raw({ labels: { tr: "Erotik Film Festivali" }, details }), "2026-10-28")).toBeNull();
    expect(toStoredEvent(raw({ labels: { en: "Fetish Week" }, details }), "2026-10-28")).toBeNull();
    // Words that only start like them are fine.
    expect(toStoredEvent(raw({ labels: { en: "Porto Wine Festival" }, details }), "2026-10-28")).not.toBeNull();
    expect(toStoredEvent(raw({ labels: { en: "Erotokritos Days" }, details }), "2026-10-28")).not.toBeNull();
  });

  it("does not keep months covering more than half the year", () => {
    expect(toStoredEvent(raw({ details: { months: [1, 2, 3, 4, 5, 6, 7], websites: [], files: [], venues: [], places: [], countries: [] } }), "2026-10-28")).toBeNull();
  });

  it("uses the Latin name rule: a Latin label over a non-Latin one", () => {
    expect(toStoredEvent(raw({ labels: { en: "Gion Matsuri" } }), "2026-10-28")?.name).toBe("Gion Matsuri");
    expect(toStoredEvent(raw({ labels: {} }), "2026-10-28")).toBeNull();
  });

  it("ranks by Wikipedia languages", () => {
    expect(rankEvents([{ qid: "Q2", wikipedias: 5 }, { qid: "Q1", wikipedias: 50 }, { qid: "Q3", wikipedias: 5 }]).map((e) => e.qid)).toEqual(["Q1", "Q2", "Q3"]);
  });
});
