import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EVENING, SIGHTS } from "@/lib/itinerary/testCity";
import { ItineraryView } from "./ItineraryView";

// MapLibre needs WebGL; the plan itself is what is under test.
vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="map" /> }));

const SEARCH = "from=IST&to=BCN&depart=2026-11-14&return=2026-11-18&pax=2";
const input = {
  depart: "2026-11-14",
  return: "2026-11-18",
  timeZone: "Europe/Madrid",
  flight: null,
  daytime: SIGHTS,
  evening: EVENING,
};
const renderView = (initialSkip: string[] = []) =>
  render(<ItineraryView input={input} initialSkip={initialSkip} cityName="Barselona" center={{ lat: 41.39, lon: 2.17 }} />);
// A day is a region named "2. gün · 15 KAS PAZ".
const day = (n: number) => screen.getByRole("region", { name: new RegExp(`^${n}\\. gün · `) });

describe("ItineraryView", () => {
  beforeEach(() => window.history.replaceState(null, "", `/plan?${SEARCH}#gun-gun-plan`));

  it("shows each day with a big numeral, its date and tags, and says the half days are an assumption", () => {
    renderView();
    expect(screen.getByText(/UÇUŞ SEÇİLMEDİ · VARSAYIM: İLK GÜN 13:00 SONRASI, SON GÜN 13:00 ÖNCESİ/)).toBeInTheDocument();
    expect(screen.getAllByText(/^0[1-5]$/)).toHaveLength(5);
    expect(within(day(1)).getByText("14 KAS CMT")).toBeInTheDocument();
    expect(within(day(1)).getByText(/VARIŞ GÜNÜ · YARIM GÜN · 13:00–21:30/)).toBeInTheDocument();
    expect(within(day(2)).getByText(/TAM GÜN · 09:00–21:30/)).toBeInTheDocument();
    expect(within(day(2)).getAllByRole("listitem").filter((li) => li.querySelector("button[aria-label$='çıkar']"))).toHaveLength(5);
  });

  it("shows times, category, duration, the walk between stops and 'check the hours'", () => {
    renderView();
    const second = day(2);
    expect(within(second).getByText("Sight 0-0")).toBeInTheDocument();
    expect(within(second).getByText("09:00")).toBeInTheDocument();
    expect(within(second).getAllByText(/^YÜRÜME ~\d+ DK · TAHMİNİ$/).length).toBeGreaterThan(0);
    expect(within(second).getAllByText("SAATLERİ DOĞRULA").length).toBeGreaterThan(0);
    expect(within(second).getByText(/AKŞAM · RESTORAN · 2 SA · TAHMİNİ/)).toBeInTheDocument();
  });

  it("removes a stop, brings in the next candidate, keeps the link in step and resets", async () => {
    const user = userEvent.setup();
    renderView();
    const removed = "Sight 0-0";
    await user.click(screen.getByRole("button", { name: `${removed} durağını plandan çıkar` }));
    expect(screen.queryByText(removed)).not.toBeInTheDocument();
    expect(window.location.search).toBe(`?${SEARCH}&skip=n100`);
    expect(window.location.hash).toBe("#gun-gun-plan");
    expect(within(day(2)).getAllByRole("button", { name: /durağını plandan çıkar$/ })).toHaveLength(5);
    await user.click(screen.getByRole("button", { name: "Planı sıfırla (1)" }));
    expect(screen.getByText(removed)).toBeInTheDocument();
    expect(window.location.search).toBe(`?${SEARCH}`);
    expect(screen.queryByRole("button", { name: /Planı sıfırla/ })).not.toBeInTheDocument();
  });

  it("opens a shared link with the same removals", () => {
    renderView(["n100", "w10"]);
    expect(screen.queryByText("Sight 0-0")).not.toBeInTheDocument();
    expect(screen.queryByText("Dinner 0-0")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Planı sıfırla (2)" })).toBeInTheDocument();
  });

  it("on a phone, choosing a day opens the map and brings it into view", async () => {
    const user = userEvent.setup();
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    renderView();
    expect(screen.queryByTestId("map")).not.toBeInTheDocument();
    await user.click(within(day(3)).getByRole("button", { name: "Haritada göster" }));
    expect(screen.getByTestId("map")).toBeInTheDocument();
    expect(screen.getByText(/^03\. GÜN · 16 KAS PZT · \d+ DURAK$/)).toBeInTheDocument();
    expect(scroll).toHaveBeenCalledTimes(1);
    scroll.mockRestore();
  });

  it("downloads the plan as an .ics file", async () => {
    const user = userEvent.setup();
    const created: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);
      return "blob:plan";
    });
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderView();
    await user.click(screen.getByRole("button", { name: /Takvime ekle/ }));
    expect(click).toHaveBeenCalledTimes(1);
    expect(created[0].type).toBe("text/calendar;charset=utf-8");
    const text = await created[0].text();
    expect(text.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(text).toContain("DTSTART;TZID=Europe/Madrid:20261115T090000");
    click.mockRestore();
  });
});
