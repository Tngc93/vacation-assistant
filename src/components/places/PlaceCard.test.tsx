import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlaceCard } from "./PlaceCard";

const props = { category: "see" as const, timeZone: "Europe/Brussels", active: false, onActivate: () => {}, onShowOnMap: () => {} };

describe("PlaceCard", () => {
  it("suggests public transport for a place far from the centre, and says nothing for the others", () => {
    const { rerender } = render(
      <PlaceCard {...props} place={{ id: "wikidata/Q180901", name: "Atomium", lat: 50.895, lon: 4.34139, wikipediaCount: 52, remote: true }} />,
    );
    expect(screen.getByText("MERKEZE UZAK · TOPLU TAŞIMA ÖNERİLİR")).toBeInTheDocument();
    rerender(<PlaceCard {...props} place={{ id: "node/1", name: "Grand-Place", lat: 50.8467, lon: 4.3525 }} />);
    expect(screen.queryByText("MERKEZE UZAK · TOPLU TAŞIMA ÖNERİLİR")).not.toBeInTheDocument();
  });
});
