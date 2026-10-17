import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OpeningHours } from "./OpeningHours";

describe("OpeningHours", () => {
  it("reads the status in the city's zone, not the machine's", () => {
    // Saturday 17 Oct 2026, 00:20 UTC: 02:20 in Barcelona, 09:20 in Tokyo.
    vi.setSystemTime(new Date("2026-10-17T00:20:00Z"));
    render(<OpeningHours value="Mo-Su 09:00-18:00" timeZone="Europe/Madrid" />);
    expect(screen.getByText("Şu an kapalı · bugün 09:00'da açılır")).toBeInTheDocument();
    render(<OpeningHours value="Mo-Su 09:00-18:00" timeZone="Asia/Tokyo" />);
    expect(screen.getByText("Şu an açık · 18:00'de kapanır")).toBeInTheDocument();
  });

  it("updates when the minute turns", () => {
    // Saturday 12:59:30 in Barcelona.
    vi.useFakeTimers({ now: new Date("2026-10-17T10:59:30Z") });
    render(<OpeningHours value="Mo-Su 13:00-01:00" timeZone="Europe/Madrid" />);
    expect(screen.getByText("Şu an kapalı · bugün 13:00'te açılır")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(30_000));
    expect(screen.getByText("Şu an açık · 01:00'de kapanır")).toBeInTheDocument();
  });

  it("handles the minutes around midnight in the city", () => {
    // Saturday 23:59 and Sunday 00:01 in Istanbul.
    vi.setSystemTime(new Date("2026-10-17T20:59:00Z"));
    const { unmount } = render(<OpeningHours value="Mo-Sa 10:00-24:00; Su off" timeZone="Europe/Istanbul" />);
    expect(screen.getByText("Şu an açık · 00:00'da kapanır")).toBeInTheDocument();
    unmount();
    vi.setSystemTime(new Date("2026-10-17T21:01:00Z"));
    render(<OpeningHours value="Mo-Sa 10:00-24:00; Su off" timeZone="Europe/Istanbul" />);
    expect(screen.getByText("Şu an kapalı · yarın 10:00'da açılır")).toBeInTheDocument();
  });

  it("renders nothing for a value it cannot read", () => {
    const { container } = render(<OpeningHours value="Mo-Fr 09:00-18:00; PH off" timeZone="Europe/Madrid" />);
    expect(container).toBeEmptyDOMElement();
  });
});
