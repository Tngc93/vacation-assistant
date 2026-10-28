import { describe, expect, it } from "vitest";
import { findDestination } from "@/data/destinations";
import { PLACE_OVERRIDES } from "@/data/place-overrides";
import { DAYTIME_CATEGORIES } from "@/lib/itinerary/config";
import { buildItinerary, chooseMustSees, farAreas, type ItineraryInput, type PlanPlace } from "@/lib/itinerary/plan";
import type { CategoryId } from "@/lib/places/categories";
import type { PlacesFile } from "@/lib/places/file";
import { loadPlacesFile } from "@/lib/places/load";
import { isLatin } from "@/lib/places/names";
import { romanize } from "@/lib/places/romanize";
import { sameNameOnce } from "@/lib/places/twins";

/**
 * The plan on the real stored data, read the way the plan page reads it (rules and overrides applied):
 * a 4-night trip without a chosen flight (half days at both ends).
 */
async function planFor(code: string, depart = "2026-11-14", ret = "2026-11-18") {
  const destination = findDestination(code)!;
  const file = (await loadPlacesFile(code))!;
  const take = (ids: readonly CategoryId[]): PlanPlace[] =>
    ids.flatMap((category) => {
      const entry = file.categories[category];
      return entry.status === "ok" ? entry.places.map((p) => ({ ...p, category })) : [];
    });
  const input: ItineraryInput = {
    depart,
    return: ret,
    timeZone: destination.timeZone,
    flight: null,
    daytime: take(DAYTIME_CATEGORIES),
    evening: take(["restaurant"]),
    skip: [],
  };
  return { input, plan: buildItinerary(input) };
}

/** The trip's five best-known must-sees: by Wikipedia languages, one visit per spot. */
const topFive = (daytime: PlanPlace[]) =>
  chooseMustSees(
    sameNameOnce([...daytime].sort((a, b) => (b.wikipediaCount ?? 0) - (a.wikipediaCount ?? 0) || (a.id < b.id ? -1 : 1))),
    100,
  ).slice(0, 5);

describe.each(["BCN", "PAR", "ROM", "LON", "AMS", "SJJ"])("plan on real data: %s", (code) => {
  it("visits the trip's five best-known places and at most one unnamed viewpoint a day", async () => {
    const { input, plan } = await planFor(code);
    // A place inside another one is visited with it, as a sub-stop.
    const planned = new Set(plan.days.flatMap((d) => d.stops.flatMap((s) => [s.id, ...(s.inside ?? []).map((c) => c.id)])));
    for (const p of topFive(input.daytime)) expect(planned.has(p.id), `${p.name} (${p.wikipediaCount})`).toBe(true);
    const byId = new Map(input.daytime.map((p) => [p.id, p]));
    for (const day of plan.days) {
      const unnamed = day.stops.filter((s) => s.category === "viewpoint" && !byId.get(s.id)?.wikidataId);
      expect(unnamed.length).toBeLessThanOrEqual(1);
    }
  });
});

describe("the Bataclan and the Moulin Rouge (place-overrides.ts)", () => {
  it("keeps the Bataclan out of the Paris guide and plan, and shows the Moulin Rouge as a 30-minute stop", async () => {
    const file = (await loadPlacesFile("PAR"))!;
    const guide = Object.values(file.categories).flatMap((e) => (e.status === "ok" ? e.places : []));
    expect(guide.some((p) => p.wikidataId === "Q810700" || /bataclan/i.test(p.name))).toBe(false);
    expect(guide.find((p) => p.wikidataId === "Q151030")).toMatchObject({ visitMin: 30 });

    const { plan } = await planFor("PAR");
    const stops = plan.days.flatMap((d) => d.stops);
    expect(stops.some((s) => /bataclan/i.test(s.name))).toBe(false);
    const moulin = stops.find((s) => s.id === "wikidata/Q151030");
    if (moulin) expect(moulin.durationMin).toBe(30);
  });
});

describe("wrong links, residences and seasonal places (rules.ts, place-overrides.ts)", () => {
  const guide = async (code: string) =>
    Object.values((await loadPlacesFile(code))!.categories).flatMap((e) => (e.status === "ok" ? e.places : []));

  it("drops the Wikipedia count of wrong links, and relinks 9/11 Memorial and Book of Kells", async () => {
    const paris = await guide("PAR");
    for (const name of ["Espace Sorbonne 4", "Pendule de Foucault"]) {
      expect(paris.find((p) => p.name === name)?.wikipediaCount, name).toBeUndefined();
    }
    expect((await guide("NYC")).find((p) => p.id === "way/278033604")).toMatchObject({ wikidataId: "Q1136137" });
    expect((await guide("NYC")).find((p) => p.id === "way/278033604")?.wikipediaCount).toBeGreaterThanOrEqual(30);
    expect((await guide("DUB")).find((p) => p.id === "node/429638456")).toMatchObject({ wikidataId: "Q856559" });
  });

  it("never plans the Élysée, the Apostolic Palace or 10 Downing Street, but keeps them in the guide", async () => {
    for (const [code, qid] of [
      ["PAR", "Q188190"],
      ["ROM", "Q145093"],
      ["LON", "Q169101"],
    ] as const) {
      const place = (await guide(code)).find((p) => p.wikidataId === qid);
      expect(place?.noVisit, `${code} ${qid}`).toBe(true);
      const { plan } = await planFor(code);
      expect(plan.days.flatMap((d) => d.stops).some((s) => s.id === place!.id)).toBe(false);
    }
  });

  it("visits Buckingham Palace inside in August, and from outside for 30 minutes in November", async () => {
    const stop = async (depart: string, ret: string) => {
      const { plan } = await planFor("LON", depart, ret);
      return plan.days.flatMap((d) => d.stops).find((s) => s.id === "relation/5208404");
    };
    const november = await stop("2026-11-14", "2026-11-18");
    expect(november).toMatchObject({ durationMin: 30, exterior: { note: "Devlet salonları yalnızca yazın açık; nöbet değişimini kaçırma" } });
    const august = await stop("2026-08-14", "2026-08-18");
    expect(august).toMatchObject({ durationMin: 120, exterior: null });
  });

  it("plans Big Ben once, inside the Palace of Westminster's visit (Wikidata P361)", async () => {
    const { plan } = await planFor("LON");
    const stops = plan.days.flatMap((d) => d.stops);
    const all = stops.flatMap((s) => [s.name, ...(s.inside ?? []).map((c) => c.name)]).filter((n) => /Big Ben|Elizabeth Tower/.test(n));
    expect(all).toHaveLength(1);
    const palace = stops.find((s) => s.inside?.some((c) => c.name === "Big Ben"));
    expect(palace?.inside?.[0]).toMatchObject({ within: "Westminster Sarayı" });
  });
});

describe("outside-only landmarks (place-overrides.ts) and the Atomium", () => {
  const stopsIn = async (code: string) => (await planFor(code)).plan.days.flatMap((d) => d.stops);

  it("keeps fountains, statues and gates short, and the Kremlin long", async () => {
    expect((await stopsIn("ROM")).find((s) => s.name === "Fontana di Trevi")).toMatchObject({ durationMin: 30, exterior: { note: null } });
    expect((await stopsIn("BER")).find((s) => s.name === "Brandenburg Kapısı")).toMatchObject({ durationMin: 20 });
    const moscow = await stopsIn("MOW");
    expect(moscow.find((s) => s.id === "relation/1360641")).toMatchObject({ durationMin: 180, exterior: null });
    const lenin = moscow.find((s) => s.id === "relation/3272726");
    if (lenin) expect(lenin.durationMin).toBe(30);
  });

  it("plans the Atomium as an area of its own, with a transport note, and drops lost statues in Athens", async () => {
    const brussels = (await planFor("BRU")).plan.days;
    const day = brussels.find((d) => d.stops.some((s) => s.id === "wikidata/Q180901"))!;
    // 5.4 km from the centre, beyond Brussels' 2 km radius: far by the rule (places/far.ts), with no override.
    expect(day.stops[0]).toMatchObject({ id: "wikidata/Q180901", farKm: 5.4 });
    const athens = await stopsIn("ATH");
    expect(athens.some((s) => ["Athena Parthenos", "Αθήνα"].includes(s.name) || s.name.includes("Προμάχου"))).toBe(false);
  });
});

describe("places inside another place on real data (containment.ts)", () => {
  const stopsIn = async (code: string) => (await planFor(code)).plan.days.flatMap((d) => d.stops);

  it("visits the Tsar Bell and the Tsar Cannon with the Kremlin, on its day, never as stops of their own", async () => {
    const stops = await stopsIn("MOW");
    const kremlin = stops.find((s) => s.id === "relation/1360641")!;
    const inside = (kremlin.inside ?? []).map((c) => c.name);
    expect(inside).toEqual(expect.arrayContaining(["Çar Topu", "Çar Çanı"]));
    expect(stops.some((s) => s.name === "Çar Topu" || s.name === "Çar Çanı")).toBe(false);
    expect(kremlin.durationMin).toBe(180);
  });

  it("visits the Raphael Rooms with the Vatican Museums, and the Sistine Chapel alone (its parent, the Apostolic Palace, is no stop)", async () => {
    const stops = await stopsIn("ROM");
    const museums = stops.find((s) => s.name === "Musei Vaticani");
    expect(museums?.inside?.map((c) => c.name)).toContain("Stanze di Raffaello");
    expect(stops.some((s) => s.name === "Cappella Sistina")).toBe(true);
  });

  it("never makes an old town or a road a parent", async () => {
    for (const code of ["STO", "TUN", "FLR", "LON"]) {
      const file = (await loadPlacesFile(code))!;
      const names = new Set(Object.values(file.categories).flatMap((e) => (e.status === "ok" ? e.places.flatMap((p) => p.parentName ?? []) : [])));
      for (const area of ["Gamla stan", "Tunus Medinesi", "Floransa'nın Tarihi Merkezi", "Piccadilly"]) expect(names.has(area), `${code} ${area}`).toBe(false);
    }
  });
});

describe("far from the centre on real data (places/far.ts: beyond max(radius, 5 km) from the tourist centre)", () => {
  const shownIn = async (code: string) =>
    Object.values((await loadPlacesFile(code))!.categories).flatMap((e) => (e.status === "ok" ? e.places : []));
  const farIn = async (code: string) =>
    (await shownIn(code))
      .filter((p) => p.farKm !== undefined)
      .map((p) => p.name)
      .sort();

  it("keeps the Eiffel Tower, the Arc de Triomphe and Park Güell near; Schönbrunn and the Atomium are far", async () => {
    // Barcelona: Park Güell is 4 km out, within the 5 km floor. Montserrat and Tibidabo are not in the data.
    expect(await farIn("BCN")).toEqual([]);
    const paris = await farIn("PAR");
    expect(paris).not.toContain("Eyfel Kulesi");
    expect(paris).not.toContain("Zafer Takı");
    expect(paris).toEqual(expect.arrayContaining(["Boulogne Ormanı", "Vincennes Ormanı"]));
    expect((await shownIn("PAR")).some((p) => /versailles/i.test(p.name))).toBe(false);
    expect(await farIn("VIE")).toEqual(["Schönbrunn Sarayı"]);
    expect((await shownIn("BRU")).find((p) => p.wikidataId === "Q180901")?.farKm).toBe(5.4);
  });

  it("measures New York from Union Square: Times Square is near, Liberty Island far", async () => {
    const nyc = await shownIn("NYC");
    expect(nyc.find((p) => p.name === "Times Square")?.farKm).toBeUndefined();
    expect(nyc.find((p) => p.name === "Liberty Adası")?.farKm).toBeGreaterThan(5);
  });

  it("fetches Tokyo around Nihonbashi: Sensō-ji, Ueno, the Skytree, the Imperial Palace, Meiji, Shibuya and Shinjuku Gyoen are in, none far", async () => {
    const tokyo = await shownIn("TYO");
    // Sensō-ji, Ueno Park, Tokyo Skytree, the Imperial Palace, Meiji Shrine, Shibuya Crossing, Shinjuku Gyoen, Tokyo Tower.
    for (const qid of ["Q615183", "Q746216", "Q57965", "Q500681", "Q287165", "Q21083961", "Q776863", "Q183536"]) {
      const place = tokyo.find((p) => p.wikidataId === qid);
      expect(place, qid).toBeDefined();
      expect(place?.farKm, qid).toBeUndefined();
    }
  });

  it.each(["BER", "BRU", "LIS", "MOW", "MUC", "NYC", "PAR", "VIE"])(
    "%s: never sends a day to two far areas, keeps a far area's planned stops on one day, and labels every far stop",
    async (code) => {
      const { input, plan } = await planFor(code);
      const area = farAreas(input.daytime);
      const dayOfArea = new Map<number, number>();
      for (const day of plan.days) {
        const areas = new Set(day.stops.flatMap((s) => (area.has(s.id) ? [area.get(s.id)!] : [])));
        expect(areas.size, `day ${day.number}`).toBeLessThanOrEqual(1);
        for (const a of areas) {
          expect(dayOfArea.get(a) ?? day.number, `far area ${a}`).toBe(day.number);
          dayOfArea.set(a, day.number);
        }
        for (const s of day.stops) expect(s.farKm !== null).toBe(area.has(s.id) || input.evening.some((e) => e.id === s.id && e.farKm !== undefined));
      }
    },
  );
});

describe("readable names on real data (places/names.ts)", () => {
  const shownIn = async (code: string) =>
    Object.values((await loadPlacesFile(code))!.categories).flatMap((e) => (e.status === "ok" ? e.places : []));
  const byQid = async (code: string, qid: string) => (await shownIn(code)).find((p) => p.wikidataId === qid);

  it("names Tokyo's and Moscow's best-known places in Turkish or English, with the local name second", async () => {
    expect(await byQid("TYO", "Q183536")).toMatchObject({ name: "Tokyo Kulesi", localName: "東京タワー" });
    expect(await byQid("TYO", "Q57965")).toMatchObject({ name: "Tokyo Skytree", localName: "東京スカイツリー" });
    expect(await byQid("TYO", "Q500681")).toMatchObject({ name: "Tokyo İmparatorluk Sarayı", localName: "皇居" });
    expect(await byQid("TYO", "Q615183")).toMatchObject({ name: "Sensō-ji" });
    // Wikidata's Turkish label for the Moscow Kremlin reads "Kremlini" (2026-10-27): a rename override fixes it.
    const kremlin = await byQid("MOW", "Q133274");
    expect(kremlin).toMatchObject({ name: "Moskova Kremlini", localName: "Московский Кремль" });
    expect((await byQid("MOW", "Q147875"))?.parentName).toBe("Moskova Kremlini");
  });

  it("shows the Latin name the data has, else the name romanized by the country's system (not in Tokyo)", async () => {
    for (const code of ["TYO", "MOW", "SEL", "ATH", "LED", "TBS", "SOF", "SKP", "TAS"]) {
      const countryCode = findDestination(code)!.countryCode;
      const stored = ((await import(`./${code}.json`)) as { default: PlacesFile }).default;
      const shown = new Map((await shownIn(code)).map((p) => [p.id, p]));
      const raw = Object.values(stored.categories).flatMap((e) => (e.status === "ok" ? e.places : []));
      for (const p of raw.filter((r) => shown.has(r.id) && !isLatin(r.name))) {
        // A wrong link (rules.ts) loses its item's labels.
        const labels = shown.get(p.id)!.wikidataId ? [p.labels?.tr, p.labels?.en] : [];
        const alternatives = [...labels, p.osmNames?.en, p.osmNames?.latin, p.osmNames?.int];
        const latin = alternatives.find((n) => n && isLatin(n));
        const renamed = PLACE_OVERRIDES[code]?.rename?.find((r) => r.qid === shown.get(p.id)!.wikidataId)?.shownName;
        const expected = renamed ?? latin ?? romanize(p.name, countryCode) ?? p.name;
        expect(shown.get(p.id)!.name, `${code} ${p.name}`).toBe(expected.trim());
        expect(isLatin(expected), `${code} ${p.name}`).toBe(code !== "TYO" || Boolean(latin));
      }
    }
  });
});

describe("cocktail bars from Wikidata (cocktails.ts)", () => {
  const cocktailsOf = async (code: string, category: CategoryId = "cocktail") => {
    const entry = (await loadPlacesFile(code))!.categories[category];
    return entry.status === "ok" ? entry.places : [];
  };
  const eveningStop = (code: string, place: PlanPlace) =>
    buildItinerary({
      depart: "2026-11-14",
      return: "2026-11-15",
      timeZone: findDestination(code)!.timeZone,
      flight: null,
      daytime: [],
      evening: [place],
      skip: [],
    })
      .days.flatMap((d) => d.stops)
      .find((s) => s.kind === "evening");

  it("adds Boadas to Barcelona's six OSM cocktail bars: OSM's bar, linked to its Wikidata item, first", async () => {
    // OSM tagged six bars for cocktails (2026-10-28); Boadas is an untagged OSM bar, joined by name within 75 m.
    const cocktail = await cocktailsOf("BCN");
    expect(cocktail.length).toBeGreaterThan(6);
    expect(cocktail[0]).toMatchObject({ id: expect.stringMatching(/^node\//), name: "Boadas", wikidataId: "Q122962985" });
    expect((await cocktailsOf("BCN", "pub")).some((p) => p.name === "Boadas")).toBe(false);
  });

  it("keeps OSM's hours for a matched bar, and asks to check them for a bar only Wikidata has", async () => {
    const nyc = await cocktailsOf("NYC");
    const attaboy = nyc.find((p) => p.wikidataId === "Q116245237")!;
    expect(attaboy.id).toMatch(/^(node|way)\//);
    expect(attaboy.openingHours).toBeTruthy();
    const pegu = nyc.find((p) => p.wikidataId === "Q116371618")!;
    expect(pegu).toMatchObject({ id: "wikidata/Q116371618", name: "Pegu Club" });
    expect(eveningStop("NYC", { ...pegu, category: "cocktail" })).toMatchObject({
      name: "Pegu Club",
      hours: "unknown",
      source: "Wikidata",
      sourceUrl: "https://www.wikidata.org/wiki/Q116371618",
    });
  });
});
