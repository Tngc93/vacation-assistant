import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ItineraryView } from "@/components/itinerary/ItineraryView";
import { EVENING, SIGHTS } from "@/lib/itinerary/testCity";
import { farCaption } from "@/lib/places/far";
import { PlaceCard } from "./PlaceCard";
import { PlacesCarousel } from "./PlacesCarousel";

// MapLibre needs WebGL; the captions are what is under test.
vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="map" /> }));

// 5.4 km east of the test city's centre, beyond its radius (places/far.ts decides; here it is given).
const FAR = { id: "wikidata/Q180901", name: "Atomium", lat: 41.39, lon: 2.235, wikipediaCount: 90, wikidataId: "Q180901", farKm: 5.4 };
const CENTRE = { lat: 41.39, lon: 2.17 };
const CAPTION = farCaption(FAR.farKm);

describe("the far-from-centre caption", () => {
  it("is the same text on the carousel card, in the place details and on the plan's stop", () => {
    expect(CAPTION).toBe("MERKEZE ~5 KM");
    const noop = () => {};
    const { unmount } = render(
      <PlacesCarousel
        items={[{ place: FAR, category: "see", rank: 1 }]}
        center={CENTRE}
        timeZone="Europe/Madrid"
        activeId={null}
        selectedId={null}
        onActivate={noop}
        onSelect={noop}
        reveal={null}
      />,
    );
    expect(screen.getByRole("button", { name: /Atomium/ })).toHaveTextContent(`Görülecek yer · ${CAPTION}`);
    unmount();

    const details = render(<PlaceCard place={FAR} category="see" timeZone="Europe/Madrid" active={false} onActivate={noop} />);
    expect(screen.getByText(CAPTION)).toBeInTheDocument();
    details.unmount();

    const input = { depart: "2026-11-14", return: "2026-11-18", timeZone: "Europe/Madrid", flight: null, daytime: [...SIGHTS, { ...FAR, category: "see" as const }], evening: EVENING };
    render(<ItineraryView input={input} initialSkip={[]} cityName="Barselona" center={CENTRE} />);
    const stop = screen.getByText("Atomium").closest("li")!;
    expect(stop).toHaveTextContent(CAPTION);
    // The day starts out there: no walking line, so the transport note sits on the stop (walking rule: over 3 km).
    expect(stop).toHaveTextContent("TOPLU TAŞIMA YA DA TAKSİ ÖNERİLİR");
    expect(screen.getAllByText(CAPTION)).toHaveLength(1);
  });

  it("is not repeated on a place inside a far stop: the sub-stop goes with it, without a caption of its own", () => {
    const pavilion = { id: "node/9002", name: "Pavilion", lat: 41.3902, lon: 2.2352, category: "see" as const, wikipediaCount: 40, wikidataId: "Q2", parentId: "Q180901", parentName: "Atomium", farKm: 5.4 };
    const input = { depart: "2026-11-14", return: "2026-11-18", timeZone: "Europe/Madrid", flight: null, daytime: [...SIGHTS, { ...FAR, category: "see" as const }, pavilion], evening: EVENING };
    render(<ItineraryView input={input} initialSkip={[]} cityName="Barselona" center={CENTRE} />);
    const sub = screen.getByText("Pavilion").closest("li")!;
    expect(sub).toHaveTextContent("ATOMİUM İÇİNDE");
    expect(sub).not.toHaveTextContent("MERKEZE ~");
    // The parent's block holds the sub-stop, and the caption appears once in it.
    expect(screen.getAllByText(CAPTION)).toHaveLength(1);
  });
});
