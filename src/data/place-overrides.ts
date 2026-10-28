/**
 * Hand-kept exceptions to the sight rules (src/lib/places/rules.ts), per city. Each entry names its Wikidata
 * item and says why in one line; src/data/place-overrides.test.ts checks every item against the city's data.
 *
 * - `include`: show a place the rules would leave out (a concert hall without a heritage listing); one the data
 *   does not have at all (beyond the city radius) is added by `npm run data:kinds`. Whether it is far from the
 *   centre is not an override: the one rule in src/lib/places/far.ts decides that for every place.
 * - `visit`: only a visit length (Lenin's Mausoleum: a short visit, queue included).
 * - `exclude`: hide a place the rules would show.
 * - `open`: a residence the rules keep out of the plan, but which visitors can enter.
 * - `exteriorOnly`: a plan stop seen from outside only (20 min unless `visitMin`); with `openMonths`, a normal
 *   visit in those months (the trip day's month, 1–12) and seen from outside in the others.
 * - `relink`: an OSM object tagged with the wrong Wikidata item; `npm run data:kinds` moves it to the right one
 *   (its Wikipedia count and kinds), so this one needs that Wikidata-only pass after a change.
 * - `rename`: the name to show (Turkish), where Wikidata's Turkish label is wrong; the stored name stays the small
 *   local name, and a place inside it shows this name in its caption. Remove it once the label is fixed.
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
export type RenameOverride = PlaceOverride & {
  /** The name shown instead of the label: "Moskova Kremlini". */
  shownName: string;
};
export type CityOverrides = {
  include?: readonly PlaceOverride[];
  exclude?: readonly PlaceOverride[];
  open?: readonly PlaceOverride[];
  exteriorOnly?: readonly ExteriorOverride[];
  visit?: readonly (PlaceOverride & { visitMin: number })[];
  relink?: readonly RelinkOverride[];
  rename?: readonly RenameOverride[];
};

export const PLACE_OVERRIDES: Readonly<Record<string, CityOverrides>> = {
  ATH: {
    exclude: [
      { qid: "Q2070605", name: "Athena Parthenos", reason: "A lost statue: nothing stands there to see." },
      { qid: "Q755221", name: "Athena Promachos", reason: "A lost statue: nothing stands there to see." },
      { qid: "Q844930", name: "Αθήνα (ancient city)", reason: "The ancient city as a whole, not a place to visit; its sites are listed one by one." },
    ],
  },
  BCN: {
    exteriorOnly: [{ qid: "Q631075", name: "Arc de Triomf", reason: "A triumphal arch, seen from outside.", visitMin: 15 }],
  },
  BER: {
    exteriorOnly: [
      { qid: "Q317027", name: "Bundeskanzleramt", reason: "The chancellery: no visits inside." },
      { qid: "Q82425", name: "Brandenburg Gate", reason: "A city gate, seen from outside.", visitMin: 20 },
    ],
  },
  BRU: {
    include: [{ qid: "Q180901", name: "Atomium", reason: "The symbol of Brussels, 5 km from the centre." }],
    exteriorOnly: [{ qid: "Q152072", name: "Manneken Pis", reason: "A small statue, seen in minutes.", visitMin: 15 }],
  },
  DUB: {
    exteriorOnly: [{ qid: "Q1134365", name: "Spire of Dublin", reason: "A monument, seen from outside.", visitMin: 15 }],
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
  GVA: {
    exteriorOnly: [{ qid: "Q684661", name: "Jet d'eau", reason: "A fountain, seen from the shore.", visitMin: 20 }],
  },
  HAM: {
    include: [{ qid: "Q673223", name: "Elbphilharmonie", reason: "Concert hall without a heritage listing, but the city's landmark." }],
  },
  HEL: {
    exteriorOnly: [{ qid: "Q523268", name: "Havis Amanda", reason: "A fountain statue, seen from outside.", visitMin: 15 }],
  },
  LED: {
    exteriorOnly: [
      { qid: "Q672444", name: "Bronze Horseman", reason: "A statue, seen from outside.", visitMin: 20 },
      { qid: "Q907366", name: "Alexander Column", reason: "A column, seen from outside.", visitMin: 15 },
    ],
  },
  LON: {
    exclude: [{ qid: "Q184619", name: "New Scotland Yard", reason: "Police headquarters; its languages come from the institution." }],
    relink: [
      {
        osmId: "node/1802652184",
        from: "Q37733713",
        qid: "Q41225",
        name: "Big Ben → Elizabeth Tower",
        reason: "OSM's item is a redirect to Elizabeth Tower (Q41225), which OSM also maps as its own object: one place.",
      },
    ],
    exteriorOnly: [
      {
        qid: "Q41225",
        name: "Big Ben (Elizabeth Tower)",
        reason: "Tours inside are in practice open only to UK residents.",
        visitMin: 30,
      },
      {
        qid: "Q42182",
        name: "Buckingham Palace",
        reason: "The State Rooms open only in summer; the rest of the year it is seen from outside.",
        visitMin: 30,
        openMonths: [7, 8, 9],
        note: "Devlet salonları yalnızca yazın açık; nöbet değişimini kaçırma",
      },
      { qid: "Q842089", name: "Nelson's Column", reason: "A column, seen from outside.", visitMin: 15 },
    ],
  },
  MOW: {
    open: [
      {
        qid: "Q133274",
        name: "Moscow Kremlin",
        reason: "Also a residence, but its cathedrals, museums and the Armoury are open to visitors.",
        visitMin: 180,
      },
    ],
    exteriorOnly: [
      { qid: "Q844124", name: "White House (Moscow)", reason: "Seat of the government: no visits inside." },
      { qid: "Q147881", name: "Tsar Cannon", reason: "A cannon on show, seen in minutes.", visitMin: 15 },
      { qid: "Q147875", name: "Tsar Bell", reason: "A bell on show, seen in minutes.", visitMin: 15 },
      { qid: "Q2075146", name: "Tomb of the Unknown Soldier", reason: "A memorial, seen from outside.", visitMin: 15 },
    ],
    visit: [{ qid: "Q191414", name: "Lenin's Mausoleum", reason: "The visit inside is short, queue included.", visitMin: 30 }],
    rename: [
      {
        qid: "Q133274",
        name: "Moscow Kremlin",
        shownName: "Moskova Kremlini",
        reason: "Wikidata's Turkish label is 'Kremlini' (a possessive without its noun); remove once the label is fixed.",
      },
    ],
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
    exteriorOnly: [
      { qid: "Q936633", name: "Palais Bourbon", reason: "Visits only on a deputy's invitation." },
      { qid: "Q631104", name: "Arc de Triomphe du Carrousel", reason: "A triumphal arch, seen from outside.", visitMin: 15 },
    ],
  },
  PRG: {
    exteriorOnly: [{ qid: "Q1630131", name: "Lennon Wall", reason: "A wall, seen from outside.", visitMin: 20 }],
  },
  RIX: {
    exteriorOnly: [{ qid: "Q337179", name: "Freedom Monument", reason: "A monument, seen from outside.", visitMin: 15 }],
  },
  ROM: {
    exteriorOnly: [
      { qid: "Q185382", name: "Trevi Fountain", reason: "A fountain, seen from the square.", visitMin: 30 },
      { qid: "Q848072", name: "Spanish Steps", reason: "A staircase, seen and climbed in half an hour.", visitMin: 30 },
      { qid: "Q265384", name: "Column of Marcus Aurelius", reason: "A column, seen from outside.", visitMin: 15 },
    ],
  },
  SOF: {
    exteriorOnly: [{ qid: "Q639704", name: "National Assembly of Bulgaria", reason: "The parliament: no regular visits inside." }],
  },
  WAW: {
    exteriorOnly: [{ qid: "Q958585", name: "Sigismund's Column", reason: "A column, seen from outside.", visitMin: 15 }],
  },
};
