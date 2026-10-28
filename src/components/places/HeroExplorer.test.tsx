import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredPlace } from "@/lib/places/file";
import type { StoredEvent } from "@/lib/events/file";
import { eventsInTrip } from "@/lib/events/trip";
import { HeroExplorer, type CategoryResult } from "./HeroExplorer";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
// MapLibre needs WebGL: a stand-in that shows the places it got, the highlighted one, and lets a dot be picked.
type MapProps = { places: StoredPlace[]; activeId: string | null; selectedId: string | null; onSelect: (id: string) => void };
vi.mock("next/dynamic", () => ({
  default: () =>
    function MapStandIn({ places, activeId, selectedId, onSelect }: MapProps) {
      return (
        <div role="region" aria-label="Mekân haritası" data-live="true" data-places={places.length} data-ids={places.map((p) => p.id).join(",")} data-active={activeId ?? ""} data-selected={selectedId ?? ""}>
          {places.map((p) => (
            <button key={p.id} type="button" onClick={() => onSelect(p.id)}>
              nokta {p.name}
            </button>
          ))}
        </div>
      );
    },
}));

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
const sights: StoredPlace[] = Array.from({ length: 5 }, (_, i) => ({ id: `node/${100 + i}`, name: `Sight ${i + 1}`, lat: 41.38 + i / 1000, lon: 2.17 }));

const results: CategoryResult[] = [
  { category: "see", status: "missing" },
  { category: "museum", status: "ok", places: [museum], wikipediaCountsAvailable: true },
  { category: "restaurant", status: "ok", places: [restaurant], wikipediaCountsAvailable: true },
];

function renderExplorer(overrides: Partial<Parameters<typeof HeroExplorer>[0]> = {}) {
  return render(
    <HeroExplorer
      title={<h1>Barselona</h1>}
      photo={<figure>foto</figure>}
      center={{ lat: 41.3825, lon: 2.1769 }}
      timeZone="Europe/Madrid"
      categories={["see", "museum", "restaurant"]}
      results={results}
      fetchedAt="2026-10-17T00:00:00.000Z"
      {...overrides}
    />,
  );
}
// A card's name is its visible text: "MUTLAKA GÖR · 01 " for sights, then the place's name.
const card = (name: RegExp | string) =>
  screen.getByRole("button", { name: typeof name === "string" ? new RegExp(`^(MUTLAKA GÖR · \\d\\d )?${name} `) : name });
const map = () => screen.getByRole("region", { name: "Mekân haritası" });
const detail = () => screen.getByRole("button", { name: "Ayrıntıyı kapat" }).closest("article")!;

describe("HeroExplorer", () => {
  beforeEach(() => {
    replace.mockReset();
    window.history.replaceState(null, "", "/plan?from=IST&to=BCN&depart=2026-11-14&return=2026-11-18&pax=2");
  });
  afterEach(() => vi.useRealTimers());

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

  it("says on a card which place it is inside, by that place's Turkish name", () => {
    const kremlin: StoredPlace = { id: "way/1", name: "Московский Кремль", lat: 55.752, lon: 37.6175, wikidataId: "Q1", wikipediaCount: 91 };
    const bell: StoredPlace = { id: "node/2", name: "Çar Çanı", lat: 55.7511, lon: 37.6176, wikidataId: "Q2", parentId: "Q1", parentName: "Moskova Kremlini" };
    renderExplorer({ results: [{ category: "see", status: "ok", places: [kremlin, bell], wikipediaCountsAvailable: true }] });
    expect(card("Çar Çanı")).toHaveTextContent("MOSKOVA KREMLİNİ İÇİNDE");
    expect(card("Московский Кремль")).not.toHaveTextContent("İÇİNDE");
  });

  it("feeds the carousel and the map from the same selection, in chip order", () => {
    const { rerender } = renderExplorer();
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual([expect.stringContaining("Picasso Müzesi"), expect.stringContaining("7 Portes")]);
    expect(map()).toHaveAttribute("data-places", "2");
    // The chips' new ?cats= comes back from the server as fewer results: both change together.
    rerender(
      <HeroExplorer
        title={<h1>Barselona</h1>}
        photo={null}
        center={{ lat: 41.3825, lon: 2.1769 }}
        timeZone="Europe/Madrid"
        categories={["restaurant"]}
        results={[results[2]]}
        fetchedAt="2026-10-17T00:00:00.000Z"
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(map()).toHaveAttribute("data-places", "1");
  });

  it("shows rank, category, walk to the centre and the must-see label on the cards", () => {
    renderExplorer({ categories: ["see"], results: [{ category: "see", status: "ok", places: sights, wikipediaCountsAvailable: true }] });
    const first = card("Sight 1");
    expect(first).toHaveTextContent("MUTLAKA GÖR · 01");
    expect(first).toHaveTextContent("Görülecek yer");
    expect(first).toHaveTextContent(/MERKEZE \d+ DK YÜRÜME/);
    expect(screen.getByText("01 / 05")).toBeInTheDocument();
  });

  it("puts the Commons photo on the card, credited in its label and in the details, lazy after the third card", async () => {
    const user = userEvent.setup();
    const photo = {
      src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/78/SF.jpg/500px-SF.jpg",
      width: 500,
      height: 333,
      fullWidth: 2588,
      author: "Canaan",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
      fileUrl: "https://commons.wikimedia.org/wiki/File:SF.jpg",
    };
    const withPhotos = sights.map((p) => ({ ...p, photo }));
    renderExplorer({ categories: ["see"], results: [{ category: "see", status: "ok", places: withPhotos, wikipediaCountsAvailable: true }] });
    const first = screen.getByRole("button", { name: /^MUTLAKA GÖR · 01 Sight 1 Görülecek yer · .*\. Fotoğraf: Canaan · CC BY-SA 4\.0 · Wikimedia Commons$/ });
    const img = first.querySelector("img")!;
    expect(img).toHaveAttribute("src", photo.src);
    expect(img.getAttribute("srcset")).toContain("500px-SF.jpg 500w");
    expect(img).toHaveAttribute("alt", "");
    expect(img.closest(".duotone")).not.toBeNull();
    expect(img).toHaveAttribute("loading", "eager");
    expect(card("Sight 4").querySelector("img")).toHaveAttribute("loading", "lazy");
    // No credit shown on the card itself, only in its (visually hidden) name…
    expect(within(first).getByText(/Canaan/)).toHaveClass("sr-only");
    // …and in the details, with links to the file and the licence.
    await user.click(first);
    expect(within(detail()).getByRole("link", { name: "Canaan" })).toHaveAttribute("href", photo.fileUrl);
    expect(within(detail()).getByRole("link", { name: "CC BY-SA 4.0" })).toHaveAttribute("href", photo.licenseUrl);
  });

  it("gives a card without a photo a large icon and the Wikidata description, else the address", () => {
    renderExplorer({
      categories: ["see"],
      results: [
        {
          category: "see",
          status: "ok",
          wikipediaCountsAvailable: true,
          places: [
            { ...sights[0], description: "Barselona'da bazilika" },
            { ...sights[1], address: "Carrer de Montcada 15" },
          ],
        },
      ],
    });
    expect(card("Sight 1").querySelector("img")).toBeNull();
    expect(card("Sight 1").querySelector("svg.lucide")).not.toBeNull();
    expect(card("Sight 1")).toHaveTextContent("Barselona'da bazilika");
    expect(card("Sight 2")).toHaveTextContent("Carrer de Montcada 15");
  });

  it("says today's hours on the card, in the city's time zone", () => {
    // Saturday 17 Oct 2026, 23:30 in Barcelona (CEST, UTC+2).
    vi.setSystemTime(new Date("2026-10-17T21:30:00Z"));
    renderExplorer();
    expect(card("7 Portes")).toHaveTextContent("BUGÜN AÇIK · 13:00–01:00");
  });

  it("lights up a card's dot on hover and selection, and opens the place's details", async () => {
    const user = userEvent.setup();
    renderExplorer();
    await user.hover(card("Picasso Müzesi"));
    expect(map()).toHaveAttribute("data-active", "node/1");
    await user.click(card("Picasso Müzesi"));
    expect(card("Picasso Müzesi")).toHaveAttribute("aria-pressed", "true");
    expect(map()).toHaveAttribute("data-selected", "node/1");
    expect(within(detail()).getByText("Carrer de Montcada 15")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ayrıntıyı kapat" }));
    expect(map()).toHaveAttribute("data-selected", "");
  });

  it("brings a card into view when its dot is picked on the map", async () => {
    const user = userEvent.setup();
    const scrollTo = vi.fn();
    Element.prototype.scrollTo = scrollTo as unknown as typeof Element.prototype.scrollTo;
    renderExplorer();
    // Until the first interaction a light dot facade stands in; the real map loads on it.
    expect(map()).not.toHaveAttribute("data-live");
    await user.hover(card("Picasso Müzesi"));
    expect(map()).toHaveAttribute("data-live", "true");
    await user.click(screen.getByRole("button", { name: "nokta 7 Portes" }));
    expect(card("7 Portes")).toHaveAttribute("aria-pressed", "true");
    expect(scrollTo).toHaveBeenCalled();
  });

  it("moves with the arrow buttons and the keyboard arrows, without animation under reduced motion", async () => {
    const user = userEvent.setup();
    const scrollTo = vi.fn();
    Element.prototype.scrollTo = scrollTo as unknown as typeof Element.prototype.scrollTo;
    renderExplorer({ categories: ["see"], results: [{ category: "see", status: "ok", places: sights, wikipediaCountsAvailable: true }] });
    // At the start "Önceki yer" is aria-disabled: still focusable, and a press does nothing.
    const previous = screen.getByRole("button", { name: "Önceki yer" });
    expect(previous).toHaveAttribute("aria-disabled", "true");
    expect(previous).not.toBeDisabled();
    await user.click(previous);
    expect(scrollTo).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Sonraki yer" }));
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: expect.stringMatching(/smooth|auto/) }));
    // The keyboard: from a focused card, the arrow moves focus to the next card.
    card("Sight 1").focus();
    fireEvent.keyDown(card("Sight 1"), { key: "ArrowRight" });
    expect(card("Sight 2")).toHaveFocus();
    fireEvent.keyDown(card("Sight 2"), { key: "ArrowLeft" });
    expect(card("Sight 1")).toHaveFocus();
    expect(scrollTo).toHaveBeenCalledTimes(3);
  });

  it("shows honest ranking captions and no ratings in the details", async () => {
    const user = userEvent.setup();
    renderExplorer();
    await user.click(card("Picasso Müzesi"));
    expect(within(detail()).getByText(/Vikipedi'de 112 dilde/)).toBeInTheDocument();
    await user.click(card("7 Portes"));
    expect(within(detail()).getByText(/OSM'de ayrıntılı kayıtlı/)).toBeInTheDocument();
    expect(screen.queryByText(/en iyi|popüler|puan:/i)).not.toBeInTheDocument();
  });

  it("links each place to Google Maps by coordinates and to its website", async () => {
    const user = userEvent.setup();
    renderExplorer();
    await user.click(card("Picasso Müzesi"));
    expect(within(detail()).getByRole("link", { name: /Google Haritalar'da aç/ })).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=41.385100%2C2.173400",
    );
    expect(within(detail()).getByRole("link", { name: /Web sitesi/ })).toHaveAttribute("href", "https://museupicasso.bcn.cat/");
  });

  it("says calmly, with one action, which category has no data yet", () => {
    renderExplorer();
    expect(screen.getByText(/Görülecek yer verisi henüz hazır değil\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /OpenStreetMap'te bak/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Yeniden dene" })).not.toBeInTheDocument();
  });

  it("shows one calm message when the city has no data file", () => {
    renderExplorer({ fetchedAt: null });
    expect(screen.getByText("Bu şehir için mekân verisi henüz hazır değil.")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Mekân kategorileri" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Mekân haritası" })).not.toBeInTheDocument();
  });

  it("turns opening hours into a status line and a readable week in the details, never the raw value", async () => {
    vi.setSystemTime(new Date("2026-10-17T21:30:00Z"));
    const user = userEvent.setup();
    renderExplorer();
    await user.click(card("7 Portes"));
    expect(screen.queryByText("Mo-Su 13:00-01:00")).not.toBeInTheDocument();
    expect(within(detail()).getByText("Şu an açık · 01:00'de kapanır")).toBeInTheDocument();
    await user.click(within(detail()).getByText("Tüm saatler"));
    expect(within(detail()).getByText("Pazartesi–Pazar 13:00–01:00")).toBeVisible();
  });

  it("names the cuisine in Turkish, keeping values it has no name for", async () => {
    const user = userEvent.setup();
    renderExplorer({
      results: [{ category: "restaurant", status: "ok", wikipediaCountsAvailable: true, places: [restaurant, { ...restaurant, id: "node/3", name: "Masala", cuisine: "indian, pizza" }] }],
      categories: ["restaurant"],
    });
    await user.click(card("Masala"));
    expect(screen.getByText("Mutfak: Hint, Pizza")).toBeInTheDocument();
    await user.click(card("7 Portes"));
    expect(screen.getByText("Mutfak: Catalan")).toBeInTheDocument();
  });

  it("hides opening hours it cannot read", async () => {
    const user = userEvent.setup();
    renderExplorer({
      results: [{ category: "restaurant", status: "ok", wikipediaCountsAvailable: true, places: [{ ...restaurant, openingHours: "Mo-Fr 09:00-18:00; PH off" }] }],
      categories: ["restaurant"],
    });
    expect(card("7 Portes")).not.toHaveTextContent(/BUGÜN/);
    await user.click(card("7 Portes"));
    expect(within(detail()).queryByText(/Şu an/)).not.toBeInTheDocument();
    expect(within(detail()).queryByText("Tüm saatler")).not.toBeInTheDocument();
    expect(screen.queryByText(/PH off/)).not.toBeInTheDocument();
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
    expect(screen.getByText("Bu kategorilerde kayıt bulamadık.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /OpenStreetMap'te bak/ })).toHaveAttribute("href", "https://www.openstreetmap.org/#map=15/41.3825/2.1769");
  });

  it("on phones opens the map strip full screen, and closes it with the button or Escape", async () => {
    const user = userEvent.setup();
    renderExplorer();
    await user.click(screen.getByRole("button", { name: /Haritayı aç/ }));
    const dialog = screen.getByRole("dialog", { name: "Harita" });
    expect(within(dialog).getByRole("button", { name: /Haritayı kapat/ })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: /Haritayı aç/ }));
    await user.click(screen.getByRole("button", { name: /Haritayı kapat/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("credits OpenStreetMap for the place data", () => {
    renderExplorer();
    expect(screen.getByRole("link", { name: "© OpenStreetMap katkıcıları" })).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
  });

  describe("events", () => {
    const oktoberfest: StoredEvent = {
      qid: "Q102400",
      name: "Oktoberfest",
      type: "festival",
      wikipedias: 77,
      months: [9, 10],
      venue: { qid: "Q700887", name: "Theresienwiese", lat: 48.131, lon: 11.549 },
      website: "https://www.oktoberfest.de/",
    };
    const fringe: StoredEvent = { qid: "Q368176", name: "Edinburgh Festival Fringe", type: "festival", wikipedias: 20, editions: [{ qid: "Q1", start: "2026-11-15", end: "2026-11-20" }] };

    it("has no Etkinlik chip when nothing falls in the dates", () => {
      renderExplorer({ events: eventsInTrip([oktoberfest], "2026-11-14", "2026-11-18"), showEvents: true });
      expect(screen.queryByRole("button", { name: "Etkinlik" })).toBeNull();
      expect(screen.queryByText(/GENELDE/)).toBeNull();
    });

    it("shows the chip and the events first, exact before approximate, off the map", () => {
      renderExplorer({ events: eventsInTrip([oktoberfest, fringe], "2026-10-01", "2026-11-16"), showEvents: true });
      expect(screen.getByRole("button", { name: "Etkinlik" })).toHaveAttribute("aria-pressed", "true");
      const cards = screen.getAllByRole("listitem").map((li) => li.textContent ?? "");
      expect(cards[0]).toContain("15 KAS – 20 KAS");
      expect(cards[0]).toContain("Edinburgh Festival Fringe");
      expect(cards[1]).toContain("GENELDE EYLÜL–EKİM · TARİHİ DOĞRULA");
      expect(cards[1]).toContain("Oktoberfest");
      expect(cards[2]).toContain("Picasso Müzesi");
      expect(map()).toHaveAttribute("data-places", "2");
    });

    it("opens an event's details with the source, the official site and the check-the-dates caption", async () => {
      const user = userEvent.setup();
      renderExplorer({ events: eventsInTrip([oktoberfest], "2026-09-20", "2026-09-24"), showEvents: true });
      await user.click(card(/Oktoberfest/));
      const details = within(detail());
      expect(details.getByText("Tarihleri resmî kaynaktan doğrula")).toBeInTheDocument();
      expect(details.getByText(/Kaynak: Wikidata/)).toBeInTheDocument();
      expect(details.getByRole("link", { name: /Resmî site/ })).toHaveAttribute("href", "https://www.oktoberfest.de/");
      expect(details.getByText("Yer: Theresienwiese")).toBeInTheDocument();
    });

    it("hides the events with the chip, keeping the token last in ?cats=", async () => {
      const user = userEvent.setup();
      const events = eventsInTrip([oktoberfest], "2026-09-20", "2026-09-24");
      renderExplorer({ events, showEvents: false });
      expect(screen.getByRole("button", { name: "Etkinlik" })).toHaveAttribute("aria-pressed", "false");
      expect(screen.queryByText(/Oktoberfest/)).toBeNull();
      await user.click(screen.getByRole("button", { name: "Etkinlik" }));
      expect(replace).toHaveBeenLastCalledWith(expect.stringContaining("cats=see%2Cmuseum%2Crestaurant%2Cevent"), { scroll: false });
    });
  });
});
