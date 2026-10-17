import { describe, expect, it } from "vitest";
import { formatCoordinates, formatLocalTime } from "./geo";

describe("city data line", () => {
  it("formats coordinates with Turkish compass letters", () => {
    expect(formatCoordinates(41.3825, 2.1769)).toBe("41,38° K · 2,18° D");
    expect(formatCoordinates(-33.9249, -70.6693)).toBe("33,92° G · 70,67° B");
  });

  it("shows the local time in the city's time zone, 24-hour", () => {
    const at = new Date("2026-10-17T09:05:00Z");
    expect(formatLocalTime(at, "Europe/Madrid")).toBe("11:05");
    expect(formatLocalTime(at, "Asia/Tokyo")).toBe("18:05");
  });
});
