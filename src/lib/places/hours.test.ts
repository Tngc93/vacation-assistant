import { describe, expect, it } from "vitest";
import { describeWeek, openStatus, parseOpeningHours, withLocative, type WeekSchedule } from "./hours";
import { EN, TR } from "@/test/i18n";

const MADRID = "Europe/Madrid";
// Thursday 16 Oct 2026 and Friday 17 Oct 2026 are Thu/Fri; Madrid is UTC+2 in October.
const at = (iso: string) => new Date(iso);
const week = (value: string) => parseOpeningHours(value) as WeekSchedule;

describe("parseOpeningHours", () => {
  it("reads day ranges, several time ranges and closed days", () => {
    const w = week("Mo-Fr 09:00-13:00,15:00-19:00; Sa 10:00-14:00; Su off");
    expect(w[0]).toEqual([
      { start: 540, end: 780 },
      { start: 900, end: 1140 },
    ]);
    expect(w[5]).toEqual([{ start: 600, end: 840 }]);
    expect(w[6]).toEqual([]);
  });

  it("handles closing after midnight, 24/7 and rules without days", () => {
    expect(week("Fr-Sa 22:00-03:00")[4]).toEqual([{ start: 1320, end: 1620 }]);
    expect(week("24/7").every((d) => d[0].end - d[0].start === 1440)).toBe(true);
    expect(week("10:00-22:00").every((d) => d[0].start === 600)).toBe(true);
    expect(week("Mo,We,Fr 08:00-12:00")[2]).toEqual([{ start: 480, end: 720 }]);
    expect(week("Fr-Mo 18:00-23:00")[0]).toEqual([{ start: 1080, end: 1380 }]);
  });

  it("accepts PH when it only adds opening days, and spaces after commas in day lists", () => {
    expect(week("Mo-Su,PH 10:00-22:00")[3]).toEqual([{ start: 600, end: 1320 }]);
    expect(week("PH,Mo-Su 10:00-02:00")[0]).toEqual([{ start: 600, end: 1560 }]);
    expect(week("Tu-We, Fr-Su 10:00-18:00; Th 10:00-20:00")[3]).toEqual([{ start: 600, end: 1200 }]);
    expect(week("Tu-We, Fr-Su 10:00-18:00; Th 10:00-20:00")[0]).toEqual([]);
  });

  it("lets later rules replace earlier ones", () => {
    expect(week("Mo-Su 09:00-18:00; Su off")[6]).toEqual([]);
  });

  it.each([
    "Mo-Fr 09:00-18:00; PH off",
    "Mo-Fr,PH off",
    "PH 10:00-14:00",
    "Mo-Su 12:00+",
    "Nov-Feb: Mo-Sa 09:00-18:00",
    "Mo-Fr 09:00-18:00 || \"by appointment\"",
    "sunrise-sunset",
    "Mo-Fr 9:00-18:00",
    "Mo-Fr 09:00-18:00, Sa 10:00-14:00",
    "Mo-Fr",
    "Mo-Su off",
    "open",
    "",
  ])("refuses %j (hidden rather than guessed)", (value) => {
    expect(parseOpeningHours(value)).toBeNull();
  });
});

describe("openStatus", () => {
  const office = week("Mo-Fr 09:30-18:00; Sa 10:00-14:00; Su off");

  it("says when an open place closes", () => {
    // Thursday 12:00 in Madrid.
    expect(openStatus(office, at("2026-10-15T10:00:00Z"), MADRID, TR)).toEqual({
      open: true,
      text: "Şu an açık · 18:00'de kapanır",
    });
  });

  it("says when a closed place opens: later today, tomorrow or on a named day", () => {
    // Thursday 08:00 → today.
    expect(openStatus(office, at("2026-10-15T06:00:00Z"), MADRID, TR)?.text).toBe("Şu an kapalı · bugün 09:30'da açılır");
    // Thursday 20:00 → tomorrow.
    expect(openStatus(office, at("2026-10-15T18:00:00Z"), MADRID, TR)?.text).toBe("Şu an kapalı · yarın 09:30'da açılır");
    // Saturday 15:00 → Monday.
    expect(openStatus(office, at("2026-10-17T13:00:00Z"), MADRID, TR)?.text).toBe(
      "Şu an kapalı · Pazartesi 09:30'da açılır",
    );
  });

  it("follows past-midnight closing and round-the-clock opening", () => {
    // Saturday 01:30 is still Friday night's opening.
    expect(openStatus(week("Fr 22:00-03:00"), at("2026-10-16T23:30:00Z"), MADRID, TR)?.text).toBe(
      "Şu an açık · 03:00'te kapanır",
    );
    expect(openStatus(week("24/7"), at("2026-10-15T10:00:00Z"), MADRID, TR)?.text).toBe("Şu an açık · 7/24");
  });

  it("speaks English on the English pages, with no Turkish suffix on the time", () => {
    const office = week("Mo-Fr 09:30-18:00");
    expect(openStatus(office, at("2026-10-15T10:00:00Z"), MADRID, EN)?.text).toBe("Open now · closes at 18:00");
    expect(openStatus(office, at("2026-10-15T18:00:00Z"), MADRID, EN)?.text).toBe("Closed now · opens tomorrow at 09:30");
    expect(openStatus(office, at("2026-10-17T13:00:00Z"), MADRID, EN)?.text).toBe("Closed now · opens on Monday at 09:30");
    expect(describeWeek(office, EN)).toEqual(["Monday–Friday 09:30–18:00", "Saturday–Sunday closed"]);
  });

  it("uses the city's own time zone", () => {
    const shop = week("Mo-Su 09:00-17:00");
    // 06:30 UTC is 08:30 in Madrid (closed) and 15:30 in Tokyo (open).
    const instant = at("2026-10-15T06:30:00Z");
    expect(openStatus(shop, instant, "Europe/Madrid", TR)?.text).toBe("Şu an kapalı · bugün 09:00'da açılır");
    expect(openStatus(shop, instant, "Asia/Tokyo", TR)?.text).toBe("Şu an açık · 17:00'de kapanır");
  });
});

describe("Turkish text", () => {
  it.each([
    ["18:00", "18:00'de"],
    ["09:30", "09:30'da"],
    ["13:00", "13:00'te"],
    ["14:40", "14:40'ta"],
    ["10:00", "10:00'da"],
    ["20:00", "20:00'de"],
    ["16:15", "16:15'te"],
    ["00:00", "00:00'da"],
    ["11:50", "11:50'de"],
  ])("%s → %s", (time, expected) => {
    expect(withLocative(time)).toBe(expected);
  });

  it("describes the week in readable Turkish", () => {
    expect(describeWeek(week("Mo-Fr 09:00-13:00,15:00-19:00; Sa 10:00-14:00; Su off"), TR)).toEqual([
      "Pazartesi–Cuma 09:00–13:00, 15:00–19:00",
      "Cumartesi 10:00–14:00",
      "Pazar kapalı",
    ]);
    expect(describeWeek(week("24/7"), TR)).toEqual(["Pazartesi–Pazar tüm gün"]);
    expect(describeWeek(week("Fr-Sa 22:00-03:00"), TR)[1]).toBe("Cuma–Cumartesi 22:00–03:00");
  });
});
