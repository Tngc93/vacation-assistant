import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DESTINATIONS } from "@/data/destinations";
import { eventsFileSchema, type EventsFile } from "./file";
import { dayNotes, eventsInTrip, mastheadLine, tripEventCaption } from "./trip";
import { MAX_EVENTS } from "./wikidata";

const dir = path.join(process.cwd(), "src/data/events");
const read = (code: string): EventsFile => eventsFileSchema.parse(JSON.parse(readFileSync(path.join(dir, `${code}.json`), "utf8")));

describe("stored event files", () => {
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

  it("has one file per destination", () => {
    expect(files.map((f) => f.slice(0, 3)).sort()).toEqual(DESTINATIONS.map((d) => d.cityCode).sort());
  });

  it.each(files)("%s is valid, above its threshold, most known first", (file) => {
    const data = read(file.slice(0, 3));
    expect(data.events.length).toBeLessThanOrEqual(MAX_EVENTS);
    for (const event of data.events) expect(event.wikipedias).toBeGreaterThanOrEqual(data.minWikipedias);
    const counts = data.events.map((e) => e.wikipedias);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });
});

describe("real data", () => {
  it("shows Oktoberfest in Munich for a late-September trip, labelled as usual dates, not as a guessed date", () => {
    const munich = read("MUC");
    const found = eventsInTrip(munich.events, "2027-09-22", "2027-09-26");
    const oktoberfest = found.find((f) => f.event.qid === "Q102400");
    expect(oktoberfest).toBeDefined();
    expect(oktoberfest!.event.venue?.name).toBe("Theresienwiese");
    // Wikidata has no Oktoberfest edition with day-precise dates (checked 2026-10-28), only its months (P2922).
    if (oktoberfest!.kind === "exact") {
      expect(oktoberfest!.edition.start.slice(5, 7)).toBe("09");
      expect(mastheadLine(found)).toBe("BU TARİHLERDE: OKTOBERFEST");
    } else {
      expect(tripEventCaption(oktoberfest!)).toBe("GENELDE EYLÜL–EKİM · TARİHİ DOĞRULA");
      expect(dayNotes([oktoberfest!], "2027-09-22", "2027-09-26")).toEqual({});
    }
  });

  it("does not show Oktoberfest in Munich in spring", () => {
    expect(eventsInTrip(read("MUC").events, "2027-04-10", "2027-04-14").some((f) => f.event.qid === "Q102400")).toBe(false);
  });
});
