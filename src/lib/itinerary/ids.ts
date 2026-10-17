/** OSM ids in URLs: "node/123" ↔ "n123", "way/45" ↔ "w45", "relation/6" ↔ "r6". */
const PREFIX = { node: "n", way: "w", relation: "r" } as const;
const BACK: Record<string, keyof typeof PREFIX> = { n: "node", w: "way", r: "relation" };

export function shortId(osmId: string): string {
  const [type, num] = osmId.split("/");
  return `${PREFIX[type as keyof typeof PREFIX] ?? "x"}${num}`;
}

export function osmIdFromShort(short: string): string | null {
  const match = /^([nwr])(\d{1,12})$/.exec(short);
  return match ? `${BACK[match[1]]}/${match[2]}` : null;
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
