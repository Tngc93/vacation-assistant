import { describe, expect, it } from "vitest";
import { DESTINATIONS } from "@/data/destinations";
import { getVisaInfo, VISA_DATA } from ".";
import { parseRequirement } from "./requirements";

// Countries we knowingly show as "Bilinmiyor". Add a code here only on purpose.
const INTENTIONALLY_UNKNOWN: readonly string[] = [];

describe("src/data/visa-tr.json", () => {
  it("records its source, commit and dates", () => {
    expect(VISA_DATA.passport).toBe("TR");
    expect(VISA_DATA.source.repository).toMatch(/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/);
    expect(VISA_DATA.source.url).toContain(VISA_DATA.source.commit);
    expect(VISA_DATA.source.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(VISA_DATA.source.dataDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(VISA_DATA.downloadedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(VISA_DATA.source.license).toBe("MIT");
  });

  it("uses ISO-2 keys", () => {
    for (const code of Object.keys(VISA_DATA.requirements)) expect(code).toMatch(/^[A-Z]{2}$/);
  });

  it("contains no value we do not understand", () => {
    const unknown = Object.entries(VISA_DATA.requirements)
      // "-1" is the passport's own country (TR → TR), not a destination we offer.
      .filter(([code]) => code !== VISA_DATA.passport)
      .filter(([, raw]) => parseRequirement(raw).kind === "unknown")
      .map(([code, raw]) => `${code}: ${raw}`);
    expect(unknown, "new requirement values need a mapping in requirements.ts").toEqual([]);
  });

  it("has a known requirement for every destination country", () => {
    const countries = [...new Set(DESTINATIONS.map((d) => d.countryCode))];
    const problems = countries
      .filter((code) => !INTENTIONALLY_UNKNOWN.includes(code))
      .filter((code) => !getVisaInfo(code).inDataset || getVisaInfo(code).requirement.kind === "unknown");
    expect(problems).toEqual([]);
  });
});

