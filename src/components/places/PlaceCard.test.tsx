import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlaceCard } from "./PlaceCard";

const props = { category: "see" as const, timeZone: "Europe/Brussels", active: false, onActivate: () => {}, onShowOnMap: () => {} };

describe("PlaceCard", () => {
  it("says how far a place beyond the radius is, suggests transport by the walking rule, and says nothing for the others", () => {
    const { rerender } = render(
      <PlaceCard {...props} place={{ id: "wikidata/Q180901", name: "Atomium", lat: 50.895, lon: 4.34139, wikipediaCount: 52, farKm: 5.4 }} />,
    );
    expect(screen.getByText("MERKEZE UZAK · ~5 KM")).toBeInTheDocument();
    expect(screen.getByText("TOPLU TAŞIMA YA DA TAKSİ ÖNERİLİR")).toBeInTheDocument();
    // Far (Malé's radius is 1 km) but within a walk of the centre: no transport note.
    rerender(<PlaceCard {...props} place={{ id: "node/3", name: "Sinamale", lat: 4.17, lon: 73.5, farKm: 1.6 }} />);
    expect(screen.getByText("MERKEZE UZAK · ~2 KM")).toBeInTheDocument();
    expect(screen.queryByText("TOPLU TAŞIMA YA DA TAKSİ ÖNERİLİR")).not.toBeInTheDocument();
    rerender(<PlaceCard {...props} place={{ id: "node/1", name: "Grand-Place", lat: 50.8467, lon: 4.3525 }} />);
    expect(screen.queryByText(/MERKEZE UZAK/)).not.toBeInTheDocument();
  });
});
