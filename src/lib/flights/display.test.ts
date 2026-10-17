import { describe, expect, it } from "vitest";
import { cacheCaption, formatDuration, formatStops, parseDirect } from "./display";
import { FLIGHTS_ERROR_MESSAGES, reasonForStatus } from "./errors";

describe("flight display", () => {
  it("says the price is cached and estimated, with the day it was found", () => {
    expect(cacheCaption("2026-10-16")).toBe("ÖNBELLEKTEN · 16 EKİ TARİHİNDE BULUNDU · TAHMİNİ");
    expect(cacheCaption(null)).toBe("ÖNBELLEKTEN · SON 48 SAATTE BULUNDU · TAHMİNİ");
  });

  it("formats durations and stops", () => {
    expect(formatDuration(245)).toBe("4 sa 05 dk");
    expect(formatDuration(55)).toBe("55 dk");
    expect(formatStops(0)).toBe("AKTARMASIZ");
    expect(formatStops(2)).toBe("2 AKTARMA");
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
    const messages = Object.values(FLIGHTS_ERROR_MESSAGES);
    expect(new Set(messages).size).toBe(messages.length);
    expect(FLIGHTS_ERROR_MESSAGES.unauthorized).toContain("401");
    expect(FLIGHTS_ERROR_MESSAGES["rate-limited"]).toContain("429");
    expect(FLIGHTS_ERROR_MESSAGES.timeout).toContain("4 saniye");
  });
});
