import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlaceCard } from "./PlaceCard";

const props = { category: "see" as const, timeZone: "Europe/Brussels", active: false, onActivate: () => {}, onShowOnMap: () => {} };

describe("PlaceCard", () => {
  it("says how far a far place is, suggests transport, and says nothing for the others", () => {
    const { rerender } = render(
      <PlaceCard {...props} place={{ id: "wikidata/Q180901", name: "Atomium", lat: 50.895, lon: 4.34139, wikipediaCount: 52, farKm: 5.4 }} />,
    );
    expect(screen.getByText("MERKEZE ~5 KM")).toBeInTheDocument();
    expect(screen.getByText("TOPLU TAŞIMA YA DA TAKSİ ÖNERİLİR")).toBeInTheDocument();
    rerender(<PlaceCard {...props} place={{ id: "node/1", name: "Grand-Place", lat: 50.8467, lon: 4.3525 }} />);
    expect(screen.queryByText(/MERKEZE ~/)).not.toBeInTheDocument();
    expect(screen.queryByText("TOPLU TAŞIMA YA DA TAKSİ ÖNERİLİR")).not.toBeInTheDocument();
  });

  it("shows a cocktail bar added from Wikidata without hours or OSM detail, with its map link", () => {
    render(
      <PlaceCard
        {...props}
        category="cocktail"
        place={{ id: "wikidata/Q122962985", name: "Boadas Cocktail Bar", lat: 41.38466, lon: 2.17027, wikidataId: "Q122962985" }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Boadas Cocktail Bar" })).toBeInTheDocument();
    expect(screen.getByText("Kokteyl bar")).toBeInTheDocument();
    expect(screen.getByText("Wikidata'da kayıtlı")).toBeInTheDocument();
    expect(screen.queryByText(/OSM'de ayrıntılı kayıtlı/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Açık|Kapalı/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Google Haritalar'da aç/ })).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=41.384660%2C2.170270",
    );
  });
});
