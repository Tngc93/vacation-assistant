import { describe, expect, it } from "vitest";
import { createI18n } from "@/i18n/i18n";
import { en } from "@/i18n/messages/en";
import { tr } from "@/i18n/messages/tr";
import { DESTINATIONS } from "@/data/destinations";
import { degreesMinutes } from "./coordinates";

const TR = createI18n("tr", tr);
const EN = createI18n("en", en);
const city = (code: string) => DESTINATIONS.find((d) => d.cityCode === code)!;

describe("degreesMinutes", () => {
  it("writes whole degrees and minutes with the Turkish compass letter", () => {
    const bcn = city("BCN");
    expect(degreesMinutes(bcn.lat, "lat", TR)).toBe("41°23′ K");
    expect(degreesMinutes(bcn.lon, "lon", TR)).toBe("2°11′ D");
  });

  it("uses the English letters on the English pages", () => {
    const bcn = city("BCN");
    expect(degreesMinutes(bcn.lat, "lat", EN)).toBe("41°23′ N");
    expect(degreesMinutes(bcn.lon, "lon", EN)).toBe("2°11′ E");
  });

  it("names the southern and western hemispheres", () => {
    expect(degreesMinutes(-33.9249, "lat", TR)).toBe("33°55′ G");
    expect(degreesMinutes(-70.6693, "lon", TR)).toBe("70°40′ B");
    expect(degreesMinutes(-33.9249, "lat", EN)).toBe("33°55′ S");
    expect(degreesMinutes(-70.6693, "lon", EN)).toBe("70°40′ W");
  });

  it("carries rounded minutes into the degree and pads them", () => {
    expect(degreesMinutes(41.9999, "lat", EN)).toBe("42°00′ N");
    expect(degreesMinutes(0.05, "lon", EN)).toBe("0°03′ E");
  });
});
