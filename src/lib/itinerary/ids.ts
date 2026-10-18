/**
 * Place ids in URLs: OSM "node/123" ↔ "n123", "way/45" ↔ "w45", "relation/6" ↔ "r6",
 * and Wikidata-only places "wikidata/Q207870" ↔ "q207870".
 */
const PREFIX = { node: "n", way: "w", relation: "r", wikidata: "q" } as const;
const BACK: Record<string, keyof typeof PREFIX> = { n: "node", w: "way", r: "relation", q: "wikidata" };

export function shortId(placeId: string): string {
  const [type, num] = placeId.split("/");
  return `${PREFIX[type as keyof typeof PREFIX] ?? "x"}${type === "wikidata" ? num.slice(1) : num}`;
}

export function osmIdFromShort(short: string): string | null {
  const match = /^([nwrq])(\d{1,12})$/.exec(short);
  if (!match) return null;
  return match[1] === "q" ? `wikidata/Q${match[2]}` : `${BACK[match[1]]}/${match[2]}`;
}

/** `?skip=n1,w2`: unknown pieces are dropped; the result is unique and sorted, so links are canonical. */
export function parseSkip(raw: string | string[] | null | undefined): string[] {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return [];
  return [...new Set(value.split(",").map((s) => s.trim()).filter((s) => osmIdFromShort(s) !== null))].sort();
}

export function serializeSkip(skip: Iterable<string>): string {
  return [...new Set(skip)].sort().join(",");
}
