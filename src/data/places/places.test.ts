import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DESTINATIONS } from "@/data/destinations";
import { CATEGORY_IDS } from "@/lib/places/categories";
import { ODBL, placesFileSchema } from "@/lib/places/file";
import { categoryCap } from "@/lib/places/rank";
import { applyPlaceRules } from "@/lib/places/rules";

const DIR = __dirname;
const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));
const read = (code: string) => JSON.parse(readFileSync(path.join(DIR, `${code}.json`), "utf8")) as unknown;

describe("src/data/places", () => {
  it("has exactly one file per destination", () => {
    expect(files.map((f) => f.replace(".json", "")).sort()).toEqual(DESTINATIONS.map((d) => d.cityCode).sort());
  });

  it("ships an ODbL notice", () => {
    expect(readFileSync(path.join(DIR, "README.md"), "utf8")).toMatch(/Open Database License \(ODbL\) 1\.0/);
  });

  describe.each(DESTINATIONS.map((d) => [d.cityCode, d] as const))("%s", (code, destination) => {
    const parsed = placesFileSchema.safeParse(read(code));

    it("matches the schema and its destination", () => {
      expect(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 3))).toBe(true);
      if (!parsed.success) return;
      expect(parsed.data.cityCode).toBe(code);
      expect(parsed.data.radiusKm).toBe(destination.radiusKm);
    });

    it("carries licence, attribution and sources", () => {
      if (!parsed.success) return;
      expect(parsed.data.license).toEqual(ODBL);
      expect(parsed.data.sources.map((s) => s.name)).toEqual(
        expect.arrayContaining(["OpenStreetMap (Overpass API)", "Wikidata", "Wikimedia Commons"]),
      );
      if (parsed.data.photo) {
        expect(parsed.data.photo.author.trim()).not.toBe("");
        expect(parsed.data.photo.license.trim()).not.toBe("");
        expect(parsed.data.photo.licenseUrl).toMatch(/^https:\/\//);
      }
    });

    it("has every category and shows at most 40 sights or museums and 30 of the rest", () => {
      if (!parsed.success) return;
      expect(Object.keys(parsed.data.categories).sort()).toEqual([...CATEGORY_IDS].sort());
      for (const [category, entry] of Object.entries(applyPlaceRules(parsed.data).categories)) {
        if (entry.status === "ok") expect(entry.places.length).toBeLessThanOrEqual(categoryCap(category as (typeof CATEGORY_IDS)[number]));
      }
    });
  });

  it("stays small", () => {
    const total = files.reduce((sum, f) => sum + statSync(path.join(DIR, f)).size, 0);
    // v4 added card photos and descriptions (about 3.6 MB → 5.7 MB for 68 cities); read only on the server.
    expect(total).toBeLessThan(7 * 1024 * 1024);
  });
});
