/**
 * Hand-kept exceptions to the sight rules (src/lib/places/rules.ts), per city. Each entry names its Wikidata
 * item and says why in one line; src/data/place-overrides.test.ts checks every item against the city's data.
 *
 * - `include`: show a place the rules would leave out (a concert hall without a heritage listing).
 * - `exclude`: hide a place the rules would show.
 * - `open`: a residence the rules keep out of the plan, but which visitors can enter.
 * - `exteriorOnly`: a plan stop seen from outside only (20 min unless `visitMin`); with `openMonths`, a normal
 *   visit in those months (the trip day's month, 1–12) and seen from outside in the others.
 * - `relink`: an OSM object tagged with the wrong Wikidata item; `npm run data:kinds` moves it to the right one
 *   (its Wikipedia count and kinds), so this one needs that Wikidata-only pass after a change.
 */
export type PlaceOverride = {
  qid: string;
  name: string;
  reason: string;
  /** Visit length in the plan, in minutes, when the usual one does not fit (a facade seen from outside). */
  visitMin?: number;
};
export type ExteriorOverride = PlaceOverride & {
  /** Months (1–12) when the inside is open and the visit is a normal one. */
  openMonths?: readonly number[];
  /** Shown on the plan stop when it is seen from outside (Turkish, the UI's language). */
  note?: string;
};
export type RelinkOverride = {
  /** The OSM object, as stored ("way/278033604"). */
  osmId: string;
  /** The item OSM tags it with, which is wrong. */
  from: string;
  /** The right item (checked on Wikidata). */
  qid: string;
  name: string;
  reason: string;
};
export type CityOverrides = {
  include?: readonly PlaceOverride[];
  exclude?: readonly PlaceOverride[];
  open?: readonly PlaceOverride[];
  exteriorOnly?: readonly ExteriorOverride[];
  relink?: readonly RelinkOverride[];
};

export const PLACE_OVERRIDES: Readonly<Record<string, CityOverrides>> = {
  BER: {
    exteriorOnly: [{ qid: "Q317027", name: "Bundeskanzleramt", reason: "The chancellery: no visits inside." }],
  },
  DUB: {
    relink: [
      {
        osmId: "node/429638456",
        from: "Q204221",
        qid: "Q856559",
        name: "Book of Kells → Library of Trinity College Dublin",
        reason:
          "OSM links the exhibition to the manuscript; the library that keeps and shows it (27 languages) fits better than the Old Library building item (3).",
      },
    ],
  },
  EDI: {
    open: [{ qid: "Q505950", name: "Palace of Holyroodhouse", reason: "A royal residence, open to visitors most of the year." }],
  },
  HAM: {
    include: [{ qid: "Q673223", name: "Elbphilharmonie", reason: "Concert hall without a heritage listing, but the city's landmark." }],
  },
  LON: {
    exclude: [{ qid: "Q184619", name: "New Scotland Yard", reason: "Police headquarters; its languages come from the institution." }],
    exteriorOnly: [
      {
        qid: "Q42182",
        name: "Buckingham Palace",
        reason: "The State Rooms open only in summer; the rest of the year it is seen from outside.",
        visitMin: 30,
        openMonths: [7, 8, 9],
        note: "Devlet salonları yalnızca yazın açık; nöbet değişimini kaçırma",
      },
    ],
  },
  MOW: {
    exteriorOnly: [{ qid: "Q844124", name: "White House (Moscow)", reason: "Seat of the government: no visits inside." }],
  },
  MUC: {
    exclude: [{ qid: "Q102400", name: "Oktoberfest", reason: "An event in late September and October, not a place to visit." }],
  },
  NYC: {
    relink: [
      {
        osmId: "way/278033604",
        from: "Q10806",
        qid: "Q1136137",
        name: "9/11 Memorial & Museum",
        reason: "OSM links the memorial to the attacks themselves; Q1136137 is the memorial and museum.",
      },
    ],
  },
  PAR: {
    include: [
      {
        qid: "Q151030",
        name: "Moulin Rouge",
        reason: "Unlisted cabaret, but one of the most photographed facades in Paris.",
        visitMin: 30,
      },
    ],
    exclude: [
      {
        qid: "Q810700",
        name: "Bataclan",
        reason: "Its many Wikipedia languages come from the 2015 attack; it is a music venue, not a sight.",
      },
      { qid: "Q193582", name: "Assemblée nationale", reason: "The parliament as an institution; its building is Palais Bourbon." },
    ],
    exteriorOnly: [{ qid: "Q936633", name: "Palais Bourbon", reason: "Visits only on a deputy's invitation." }],
  },
  SOF: {
    exteriorOnly: [{ qid: "Q639704", name: "National Assembly of Bulgaria", reason: "The parliament: no regular visits inside." }],
  },
};
