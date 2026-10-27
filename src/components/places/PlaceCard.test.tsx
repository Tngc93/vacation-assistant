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
});
