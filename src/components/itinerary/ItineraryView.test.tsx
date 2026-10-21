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
    // A full day: more than the old four daytime stops, plus the evening place.
    expect(within(day(2)).getAllByRole("button", { name: /durağını plandan çıkar$/ }).length).toBeGreaterThan(5);
  });

  it("with a web-search flight price in the budget, uses the default windows and says the flight times are unknown", () => {
    render(<ItineraryView input={input} initialSkip={[]} cityName="Barselona" center={{ lat: 41.39, lon: 2.17 }} flightTimesUnknown />);
    expect(screen.getByText("UÇUŞ SAATİ BİLİNMİYOR · VARSAYILAN SAATLER")).toBeInTheDocument();
    expect(screen.queryByText(/^UÇUŞ: /)).toBeNull();
    expect(within(day(1)).getByText(/VARIŞ GÜNÜ · YARIM GÜN · 13:00–21:30/)).toBeInTheDocument();
  });

  it("shows times, category, duration, the walk between stops and 'check the hours'", () => {
    renderView();
    const second = screen.getByText("Sight 0-0").closest("section")!;
    expect(within(second).getAllByText(/^\d{2}:\d{2}$/).length).toBeGreaterThan(0);
    expect(within(second).getAllByText(/^YÜRÜME ~\d+ DK · TAHMİNİ$/).length).toBeGreaterThan(0);
    expect(within(second).getAllByText("SAATLERİ DOĞRULA").length).toBeGreaterThan(0);
    expect(within(second).getByText(/AKŞAM · RESTORAN · 2 SA · TAHMİNİ/)).toBeInTheDocument();
  });

  it("removes a stop, brings in the next candidate, keeps the link in step and resets", async () => {
    const user = userEvent.setup();
    renderView();
    const removed = "Sight 0-0";
    const before = within(day(2)).getAllByRole("button", { name: /durağını plandan çıkar$/ }).length;
    await user.click(screen.getByRole("button", { name: `${removed} durağını plandan çıkar` }));
    expect(screen.queryByText(removed)).not.toBeInTheDocument();
    expect(window.location.search).toBe(`?${SEARCH}&skip=n100`);
    expect(window.location.hash).toBe("#gun-gun-plan");
    expect(within(day(2)).getAllByRole("button", { name: /durağını plandan çıkar$/ })).toHaveLength(before);
    await user.click(screen.getByRole("button", { name: "Planı sıfırla (1)" }));
    expect(screen.getByText(removed)).toBeInTheDocument();
    expect(window.location.search).toBe(`?${SEARCH}`);
    expect(screen.queryByRole("button", { name: /Planı sıfırla/ })).not.toBeInTheDocument();
  });

  it("shows free time and links a flight-limited day to the flights section", () => {
    render(
      <ItineraryView
        input={{
          ...input,
          daytime: SIGHTS.slice(0, 1),
          evening: EVENING.map((p) => ({ ...p, openingHours: "Mo-Su 12:00-01:00" })),
          flight: { arrive: { date: "2026-11-14", time: "19:30" }, leave: { date: "2026-11-18", time: "06:55" }, label: "Pegasus · PC 438" },
        }}
        initialSkip={[]}
        cityName="Barselona"
        center={{ lat: 41.39, lon: 2.17 }}
      />,
    );
    expect(within(day(1)).getByText("Bu uçuşla varış 19:30'da; ilk gün yalnızca yerleşme ve akşam yemeği.")).toBeInTheDocument();
    expect(within(day(1)).getByRole("link", { name: "Daha uygun saatli uçuşlara bak" })).toHaveAttribute("href", "#ucuslar");
    expect(within(day(5)).getByText("Bu uçuşla dönüş kalkışı 06:55'te; son gün havalimanına geçiş için.")).toBeInTheDocument();
    const withSight = screen.getByText("Sight 0-0").closest("section")!;
    expect(within(withSight).getByText(/^SERBEST ZAMAN · \d{2}:\d{2}–\d{2}:\d{2}$/)).toBeInTheDocument();
    expect(within(day(3)).queryByRole("link", { name: "Daha uygun saatli uçuşlara bak" })).not.toBeInTheDocument();
  });

  it("marks unknown hours quietly, warns only near closing time, and names another country", () => {
    const closing = { ...SIGHTS[0], openingHours: "Mo-Su 09:00-10:20" }; // a 09:00 visit ends 10:00, it closes 10:20
    const vatican = { ...SIGHTS[1], name: "San Pietro Bazilikası", country: "VA" };
    render(
      <ItineraryView
        input={{ ...input, daytime: [closing, vatican, ...SIGHTS.slice(2)] }}
        initialSkip={[]}
        cityName="Roma"
        center={{ lat: 41.39, lon: 2.17 }}
      />,
    );
    expect(screen.getByText("Saat bilgisi olmayan mekânlar işaretlidir; gitmeden kontrol et.")).toBeInTheDocument();
    for (const note of screen.getAllByText("SAATLERİ DOĞRULA")) expect(note).not.toHaveClass("text-warn");
    const warning = screen.getByText("KAPANIŞA YAKIN · 10:20'DE KAPANIR");
    expect(warning).toHaveClass("text-warn");
    expect(screen.getByText("San Pietro Bazilikası").closest("li")!).toHaveTextContent("VATİKAN · ");
  });

  it("says when a stop is seen from outside only, with its note", () => {
    const palace = { ...SIGHTS[0], name: "Buckingham Palace", exterior: { visitMin: 30, openMonths: [7, 8, 9], note: "Devlet salonları yalnızca yazın açık; nöbet değişimini kaçırma" } };
    render(<ItineraryView input={{ ...input, daytime: [palace, ...SIGHTS.slice(1)] }} initialSkip={[]} cityName="Londra" center={{ lat: 41.39, lon: 2.17 }} />);
    const stop = screen.getByText("Buckingham Palace").closest("li")!;
    expect(within(stop).getByText("YALNIZCA DIŞARIDAN")).toHaveClass("text-sea");
    expect(stop).toHaveTextContent("Devlet salonları yalnızca yazın açık; nöbet değişimini kaçırma");
    expect(stop).toHaveTextContent("30 DK");
  });

  it("suggests public transport for a remote stop", () => {
    const atomium = { ...SIGHTS[0], name: "Atomium", lat: 41.39, lon: 2.23, wikipediaCount: 52, remote: true as const };
    render(<ItineraryView input={{ ...input, daytime: [...SIGHTS.slice(1), atomium] }} initialSkip={[]} cityName="Brüksel" center={{ lat: 41.39, lon: 2.17 }} />);
    expect(screen.getByText("Atomium").closest("li")!).toHaveTextContent("MERKEZE UZAK · TOPLU TAŞIMA ÖNERİLİR");
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
