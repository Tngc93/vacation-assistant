import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocalTime } from "./LocalTime";

describe("LocalTime", () => {
  it("shows the city's time for the same instant, whatever the machine's zone", () => {
    // 00:20 UTC = 03:20 in Istanbul (the time CI failed at), 02:20 in Barcelona, 09:20 in Tokyo.
    vi.setSystemTime(new Date("2026-10-17T00:20:00Z"));
    render(<LocalTime timeZone="Europe/Istanbul" />);
    render(<LocalTime timeZone="Europe/Madrid" />);
    render(<LocalTime timeZone="Asia/Tokyo" />);
    expect(screen.getByText("Yerel saat 03:20")).toBeInTheDocument();
    expect(screen.getByText("Yerel saat 02:20")).toBeInTheDocument();
    expect(screen.getByText("Yerel saat 09:20")).toBeInTheDocument();
  });

  it("ticks at the start of each minute, across midnight", () => {
    // 23:59:45 in Istanbul.
    vi.useFakeTimers({ now: new Date("2026-10-17T20:59:45Z") });
    render(<LocalTime timeZone="Europe/Istanbul" />);
    expect(screen.getByText("Yerel saat 23:59")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(14_999));
    expect(screen.getByText("Yerel saat 23:59")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText("Yerel saat 00:00")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText("Yerel saat 00:01")).toBeInTheDocument();
  });
});
