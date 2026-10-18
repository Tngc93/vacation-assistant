/**
 * Hand-kept exceptions to the sight rules (src/lib/places/rules.ts), per city.
 * `include` shows a place the rules would leave out; `exclude` hides one they
 * would show. Each entry names its Wikidata item and says why in one line;
 * an included place may set its visit length in the plan (`visitMin`).
 * src/data/place-overrides.test.ts checks that every item is in the city's data.
 */
export type PlaceOverride = {
  qid: string;
  name: string;
  reason: string;
  /** Visit length in the plan, in minutes, when the usual one does not fit (a facade seen from outside). */
  visitMin?: number;
};
export type CityOverrides = { include?: readonly PlaceOverride[]; exclude?: readonly PlaceOverride[] };

export const PLACE_OVERRIDES: Readonly<Record<string, CityOverrides>> = {
  HAM: {
    include: [{ qid: "Q673223", name: "Elbphilharmonie", reason: "Concert hall without a heritage listing, but the city's landmark." }],
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
    ],
  },
};
