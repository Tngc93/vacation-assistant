import { describe, expect, it } from "vitest";
import { cacheCaption, formatDuration, formatStops, parseDirect } from "./display";
import { reasonForStatus } from "./errors";
import { EN, TR } from "@/test/i18n";

describe("flight display", () => {
  it("says the price is cached and estimated, with the day it was found", () => {
    expect(cacheCaption("2026-10-16", TR)).toBe("ÖNBELLEKTEN · 16 EKİ TARİHİNDE BULUNDU · TAHMİNİ");
    expect(cacheCaption(null, TR)).toBe("ÖNBELLEKTEN · SON 48 SAATTE BULUNDU · TAHMİNİ");
  });

  it("formats durations and stops", () => {
    expect(formatDuration(245, TR)).toBe("4 sa 05 dk");
    expect(formatDuration(55, TR)).toBe("55 dk");
    expect(formatStops(0, TR)).toBe("AKTARMASIZ");
    expect(formatStops(2, TR)).toBe("2 AKTARMA");
    expect(formatDuration(245, EN)).toBe("4 h 05 min");
    expect(formatStops(0, EN)).toBe("NON-STOP");
    expect(formatStops(1, EN)).toBe("1 STOP");
    expect(cacheCaption("2026-10-16", EN)).toBe("CACHED · FOUND ON 16 OCT · ESTIMATED");
  });

  it("reads the non-stop filter from the URL", () => {
    expect(parseDirect("1")).toBe(true);
    expect(parseDirect(["1"])).toBe(true);
    expect(parseDirect("true")).toBe(false);
    expect(parseDirect(undefined)).toBe(false);
  });
});

describe("flight errors", () => {
  it("gives 401, 429 and 5xx their own reasons", () => {
    expect(reasonForStatus(200)).toBeNull();
    expect(reasonForStatus(401)).toBe("unauthorized");
    expect(reasonForStatus(403)).toBe("unauthorized");
    expect(reasonForStatus(429)).toBe("rate-limited");
    expect(reasonForStatus(500)).toBe("server");
    expect(reasonForStatus(503)).toBe("server");
    expect(reasonForStatus(404)).toBe("unavailable");
  });

  it("has a distinct, plain message for each reason", () => {
    const messages = Object.values(TR.m.flights.errors);
    expect(new Set(messages).size).toBe(messages.length);
    expect(TR.m.flights.errors.unauthorized).toContain("401");
    expect(TR.m.flights.errors["rate-limited"]).toContain("429");
    expect(TR.m.flights.errors.timeout).toContain("4 saniye");
  });
});
