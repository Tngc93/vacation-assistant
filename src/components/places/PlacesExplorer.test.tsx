import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RankedPlace } from "@/lib/places/rank";
import { PlacesExplorer, type CategoryResult } from "./PlacesExplorer";

const replace = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
// MapLibre needs WebGL; the explorer's own behaviour is what is under test here.
vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="map" /> }));

const museum: RankedPlace = {
  id: "node/1",
  category: "museum",
  name: "Picasso Müzesi",
  localName: "Museu Picasso",
  lat: 41.3851,
  lon: 2.1734,
  address: "Carrer de Montcada 15",
  website: "https://museupicasso.bcn.cat/",
  wikipediaCount: 112,
};
const restaurant: RankedPlace = {
  id: "node/2",
  category: "restaurant",
  name: "7 Portes",
  lat: 41.382,
  lon: 2.183,
  openingHours: "Mo-Su 13:00-01:00",
  cuisine: "catalan",
  detailed: true,
};

const results: CategoryResult[] = [
  { category: "see", status: "error" },
  { category: "museum", status: "ok", places: [museum], wikipediaCountsAvailable: true },
  { category: "restaurant", status: "ok", places: [restaurant], wikipediaCountsAvailable: true },
];

function renderExplorer(overrides: Partial<Parameters<typeof PlacesExplorer>[0]> = {}) {
  return render(
    <PlacesExplorer
      center={{ lat: 41.3825, lon: 2.1769 }}
      categories={["see", "museum", "restaurant"]}
      results={results}
      {...overrides}
    />,
  );
}

describe("PlacesExplorer", () => {
  beforeEach(() => {
    replace.mockReset();
    refresh.mockReset();
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

  it("shows a calm error with one action per failed category", async () => {
    const user = userEvent.setup();
    renderExplorer();
    const section = screen.getByRole("heading", { name: "Görülecek yer", level: 3 }).closest("section")!;
    expect(within(section).getByText("Bu kategorinin verisi şu an alınamadı.")).toBeInTheDocument();
    await user.click(within(section).getByRole("button", { name: "Yeniden dene" }));
    expect(refresh).toHaveBeenCalled();
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
    await user.click(screen.getAllByRole("button", { name: /Haritada göster/ })[0]);
    expect(screen.getByTestId("map")).toBeInTheDocument();
  });

  it("credits OpenStreetMap for the place data", () => {
    renderExplorer();
    expect(screen.getByRole("link", { name: "© OpenStreetMap katkıcıları" })).toHaveAttribute(
      "href",
      "https://www.openstreetmap.org/copyright",
    );
  });
});
