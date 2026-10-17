import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredPlace } from "@/lib/places/file";
import { PlacesExplorer, type CategoryResult } from "./PlacesExplorer";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
// MapLibre needs WebGL; the explorer's own behaviour is what is under test here.
vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="map" /> }));

const museum: StoredPlace = {
  id: "node/1",
  name: "Picasso Müzesi",
  localName: "Museu Picasso",
  lat: 41.3851,
  lon: 2.1734,
  address: "Carrer de Montcada 15",
  website: "https://museupicasso.bcn.cat/",
  wikipediaCount: 112,
};
const restaurant: StoredPlace = {
  id: "node/2",
  name: "7 Portes",
  lat: 41.382,
  lon: 2.183,
  openingHours: "Mo-Su 13:00-01:00",
  cuisine: "catalan",
  detailed: true,
};

const results: CategoryResult[] = [
  { category: "see", status: "missing" },
  { category: "museum", status: "ok", places: [museum], wikipediaCountsAvailable: true },
  { category: "restaurant", status: "ok", places: [restaurant], wikipediaCountsAvailable: true },
];

function renderExplorer(overrides: Partial<Parameters<typeof PlacesExplorer>[0]> = {}) {
  return render(
    <PlacesExplorer
      center={{ lat: 41.3825, lon: 2.1769 }}
      timeZone="Europe/Madrid"
      categories={["see", "museum", "restaurant"]}
      results={results}
      fetchedAt="2026-10-17T00:00:00.000Z"
      {...overrides}
    />,
  );
}

describe("PlacesExplorer", () => {
  beforeEach(() => {
    replace.mockReset();
    window.history.replaceState(null, "", "/plan?from=IST&to=BCN&depart=2026-11-14&return=2026-11-18&pax=2");
  });

  it("marks the selected categories and writes changes to ?cats=", async () => {
    const user = userEvent.setup();
    renderExplorer();
    expect(screen.getByRole("button", { name: "Görülecek yer" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Kokteyl bar" })).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByRole("button", { name: "Kokteyl bar" }));
    expect(replace).toHaveBeenCalledWith(
      "/plan?from=IST&to=BCN&depart=2026-11-14&return=2026-11-18&pax=2&cats=see%2Cmuseum%2Crestaurant%2Ccocktail",
      { scroll: false },
    );

    await user.click(screen.getByRole("button", { name: "Müze" }));
    expect(replace).toHaveBeenLastCalledWith(expect.stringContaining("cats=see%2Crestaurant"), { scroll: false });
  });

  it("shows honest ranking captions and no ratings", () => {
    renderExplorer();
    const museumCard = screen.getByRole("heading", { name: "Picasso Müzesi" }).closest("article")!;
    expect(within(museumCard).getByText(/Vikipedi'de 112 dilde/)).toBeInTheDocument();
    const restaurantCard = screen.getByRole("heading", { name: "7 Portes" }).closest("article")!;
    expect(within(restaurantCard).getByText(/OSM'de ayrıntılı kayıtlı/)).toBeInTheDocument();
    expect(screen.queryByText(/en iyi|popüler|puan:/i)).not.toBeInTheDocument();
  });

  it("links each place to Google Maps by coordinates and to its website", () => {
    renderExplorer();
    const card = screen.getByRole("heading", { name: "Picasso Müzesi" }).closest("article")!;
    expect(within(card).getByRole("link", { name: /Google Haritalar'da aç/ })).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=41.385100%2C2.173400",
    );
    expect(within(card).getByRole("link", { name: /Web sitesi/ })).toHaveAttribute("href", "https://museupicasso.bcn.cat/");
  });

  it("shows a calm message with one action when a category has no data yet", () => {
    renderExplorer();
    const section = screen.getByRole("heading", { name: "Görülecek yer", level: 3 }).closest("section")!;
    expect(within(section).getByText("Bu kategorinin verisi henüz hazır değil.")).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: /OpenStreetMap'te bak/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Yeniden dene" })).not.toBeInTheDocument();
  });

  it("shows one calm message when the city has no data file", () => {
    renderExplorer({ fetchedAt: null });
    expect(screen.getByText("Bu şehir için mekân verisi henüz hazır değil.")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Mekân kategorileri" })).not.toBeInTheDocument();
  });

  it("turns opening hours into a status line and a readable week, never the raw value", async () => {
    // Saturday 17 Oct 2026, 23:30 in Barcelona (CEST, UTC+2).
    vi.setSystemTime(new Date("2026-10-17T21:30:00Z"));
    const user = userEvent.setup();
    renderExplorer();
    const card = screen.getByRole("heading", { name: "7 Portes" }).closest("article")!;
    expect(within(card).queryByText("Mo-Su 13:00-01:00")).not.toBeInTheDocument();
    expect(within(card).getByText("Şu an açık · 01:00'de kapanır")).toBeInTheDocument();
    await user.click(within(card).getByText("Tüm saatler"));
    expect(within(card).getByText("Pazartesi–Pazar 13:00–01:00")).toBeVisible();
  });

  it("hides opening hours it cannot read", () => {
    renderExplorer({
      results: [
        {
          category: "restaurant",
          status: "ok",
          wikipediaCountsAvailable: true,
          places: [{ ...restaurant, openingHours: "Mo-Fr 09:00-18:00; PH off" }],
        },
      ],
      categories: ["restaurant"],
    });
    const card = screen.getByRole("heading", { name: "7 Portes" }).closest("article")!;
    expect(within(card).queryByText(/Şu an/)).not.toBeInTheDocument();
    expect(within(card).queryByText("Tüm saatler")).not.toBeInTheDocument();
    expect(within(card).queryByText(/PH off/)).not.toBeInTheDocument();
  });

  it("states when the place data was fetched, as a date in Istanbul whatever the machine's zone", () => {
    renderExplorer();
    expect(screen.getByText(/17 Eki 2026 tarihinde alındı/)).toBeInTheDocument();
    // 22:30 UTC on the 16th is already the 17th in Istanbul.
    renderExplorer({ fetchedAt: "2026-10-16T22:30:00.000Z" });
    expect(screen.getAllByText(/17 Eki 2026 tarihinde alındı/)).toHaveLength(2);
  });

  it("shows a calm empty state with one action", () => {
    renderExplorer({ categories: ["club"], results: [{ category: "club", status: "ok", places: [], wikipediaCountsAvailable: true }] });
    expect(screen.getByText("Bu kategoride kayıt bulamadık.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /OpenStreetMap'te bak/ })).toHaveAttribute(
      "href",
      "https://www.openstreetmap.org/#map=15/41.3825/2.1769",
    );
  });

  it("loads the map on phones only when asked, and from 'Haritada göster'", async () => {
    const user = userEvent.setup();
    renderExplorer();
    expect(screen.queryByTestId("map")).not.toBeInTheDocument();
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    await user.click(screen.getAllByRole("button", { name: /Haritada göster/ })[0]);
    expect(screen.getByTestId("map")).toBeInTheDocument();
    // The scroll happens after the map container renders, inside the click, not on a later frame.
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.contexts[0]).toContainElement(screen.getByTestId("map"));
    scroll.mockRestore();
  });

  it("credits OpenStreetMap for the place data", () => {
    renderExplorer();
    expect(screen.getByRole("link", { name: "© OpenStreetMap katkıcıları" })).toHaveAttribute(
      "href",
      "https://www.openstreetmap.org/copyright",
    );
  });
});
