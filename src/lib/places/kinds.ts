/**
 * Kinds of sights, from their Wikidata types (P31 with all subclasses) and
 * heritage designations (P1435). The data script stores a place's kinds as
 * these short tags, only for the classes the rules below use, so the files
 * stay small; the rules themselves run when the files are read (rules.ts),
 * and changing them needs no refetch.
 */
export const KIND_CLASSES = {
  Q33506: "museum",
  Q839954: "ruins",
  Q570116: "attraction",
  Q16560: "palace",
  Q23413: "castle",
  Q24398318: "religious",
  Q12518: "tower",

  Q79007: "street",
  Q62685721: "street",
  Q174782: "square",
  Q12280: "bridge",
  Q787113: "promenade",
  Q88372: "promenade",

  Q1060829: "concertHall",
  Q8719053: "musicVenue",
  Q1684522: "musicVenue",
  Q24354: "theatre",
  Q57660343: "performingArts",
  Q153562: "opera",
  Q622425: "nightclub",
  Q1228895: "nightclub",
  Q41253: "cinema",

  Q1076486: "sportsVenue",
  Q55488: "station",
  Q12819564: "station",
  Q719456: "station",
  Q928830: "station",
  Q44782: "port",
  Q1248784: "airport",
  Q27686: "hotel",
  Q2338524: "racetrack",
  Q34442: "road",
  Q11303: "skyscraper",
  Q1021645: "office",
  Q4830453: "business",
  Q3914: "school",
  Q3918: "university",
  Q2923447: "waterline",
  Q3116860: "landscape",

  Q56061: "adminArea",
  Q6256: "country",
  Q3624078: "country",
  Q133442: "country",
} as const;

/** Any heritage designation (P1435), and World Heritage (P1435 = Q9259). */
export const HERITAGE_TAG = "heritage";
export const UNESCO_TAG = "unesco";
export const WORLD_HERITAGE_QID = "Q9259";

export const KIND_TAGS = [...new Set([...Object.values(KIND_CLASSES), HERITAGE_TAG, UNESCO_TAG])] as [string, ...string[]];
export type KindTag = (typeof KIND_CLASSES)[keyof typeof KIND_CLASSES] | typeof HERITAGE_TAG | typeof UNESCO_TAG;
