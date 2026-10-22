/**
 * Card photos and short descriptions for places with a Wikidata item, fetched ahead of time (`npm run
 * data:places`): Wikidata P18 (the item's image) and its description, Turkish first, then English. The Commons
 * file's author and licence come from extmetadata; the city photo's licence filter applies unchanged (CC0,
 * public domain, CC BY, CC BY-SA), and a file that fails it is not stored.
 */
import { externalFetch, timeoutSignal } from "@/lib/net";
import { photoFromImageInfo } from "@/lib/city/photo";
import { KINDS_BATCH, sparql } from "./landmarks";
import { USER_AGENT, type Fetcher } from "./overpass";
import type { PlacesFile, StoredPlace } from "./file";

/**
 * Commons serves thumbnails only at standard widths (checked 2026-10-22: 330, 500, 960 answer, 640 is refused).
 * Cards use 330 and 500: a card is at most ~320 CSS px wide, and 960 tripled the bytes on phones for no visible
 * gain under the duotone.
 */
export const CARD_PHOTO_WIDTHS = [330, 500] as const;
/** The stored `src` width; the others are derived from it for srcset. */
export const CARD_PHOTO_WIDTH = 500;
const COMMONS_BATCH = 50;
const COMMONS_TIMEOUT_MS = 15_000;

export type PlaceExtras = { file?: string; description?: string };

const qidOf = (uri: string | undefined) => /Q[1-9]\d*$/.exec(uri ?? "")?.[0] ?? null;

/** Each item's P18 (best rank) and its Turkish and English descriptions. */
export function extrasQuery(qids: readonly string[]): string {
  return `SELECT ?item (SAMPLE(?img) AS ?image) (SAMPLE(?dtr) AS ?tr) (SAMPLE(?den) AS ?en) WHERE {
  VALUES ?item { ${qids.map((q) => `wd:${q}`).join(" ")} }
  OPTIONAL { ?item wdt:P18 ?img }
  OPTIONAL { ?item schema:description ?dtr FILTER(LANG(?dtr) = "tr") }
  OPTIONAL { ?item schema:description ?den FILTER(LANG(?den) = "en") }
} GROUP BY ?item`;
}

/** "http://commons.wikimedia.org/wiki/Special:FilePath/La%20Sagrada.jpg" → "La Sagrada.jpg" */
export function commonsFileName(uri: string | undefined): string | null {
  const m = /Special:FilePath\/(.+)$/.exec(uri ?? "");
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]).replace(/_/g, " ");
  } catch {
    return null;
  }
}

type Binding = Record<string, { value: string } | undefined>;

export function parseExtras(json: unknown): Map<string, PlaceExtras> {
  const out = new Map<string, PlaceExtras>();
  for (const b of (json as { results?: { bindings?: Binding[] } }).results?.bindings ?? []) {
    const item = qidOf(b.item?.value);
    if (!item) continue;
    const file = commonsFileName(b.image?.value) ?? undefined;
    const description = (b.tr?.value ?? b.en?.value)?.trim() || undefined;
    out.set(item, { ...(file ? { file } : {}), ...(description ? { description } : {}) });
  }
  return out;
}

export type CardPhoto = NonNullable<StoredPlace["photo"]>;

type ImageInfoPage = { title?: string; imageinfo?: Array<NonNullable<Parameters<typeof photoFromImageInfo>[0]> & { width?: number }> };

/** Commons imageinfo for up to 50 files at a time, at the card width; files failing the licence filter are left out. */
export async function fetchCardPhotos(
  files: readonly string[],
  { fetcher = externalFetch }: { fetcher?: Fetcher } = {},
): Promise<Map<string, CardPhoto>> {
  const unique = [...new Set(files)].sort();
  const out = new Map<string, CardPhoto>();
  for (let i = 0; i < unique.length; i += COMMONS_BATCH) {
    const batch = unique.slice(i, i + COMMONS_BATCH);
    const url = `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({
      action: "query",
      titles: batch.map((f) => `File:${f}`).join("|"),
      prop: "imageinfo",
      iiprop: "url|size|extmetadata",
      iiurlwidth: String(CARD_PHOTO_WIDTH),
      iiextmetadatafilter: "License|LicenseShortName|LicenseUrl|Artist|Credit",
      format: "json",
      formatversion: "2",
    })}`;
    const res = await fetcher(url, { headers: { "User-Agent": USER_AGENT }, signal: timeoutSignal(COMMONS_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`Commons HTTP ${res.status}`);
    const json = (await res.json()) as { query?: { pages?: ImageInfoPage[]; normalized?: Array<{ from: string; to: string }> } };
    // Commons normalises titles (underscores, first letter); map them back to the names asked for.
    const asked = new Map((json.query?.normalized ?? []).map((n) => [n.to, n.from]));
    for (const page of json.query?.pages ?? []) {
      const title = page.title ?? "";
      const info = page.imageinfo?.[0];
      const photo = photoFromImageInfo(info);
      if (!photo) continue;
      const file = (asked.get(title) ?? title).replace(/^File:/, "");
      // The original's width: Commons makes no thumbnail wider than the file, so srcset stops there.
      out.set(file, { ...photo, ...(info?.width ? { fullWidth: info.width } : {}) });
    }
  }
  return out;
}

/**
 * Adds `photo` and `description` to every stored place that has a Wikidata item. Throws if a query fails (the
 * caller decides whether the city is written without them).
 */
export async function addPhotosAndDescriptions(file: PlacesFile, { fetcher = externalFetch }: { fetcher?: Fetcher } = {}): Promise<PlacesFile> {
  const places = Object.values(file.categories).flatMap((c) => (c.status === "ok" ? c.places : []));
  const qids = [...new Set(places.flatMap((p) => p.wikidataId ?? []))].sort();
  const extras = new Map<string, PlaceExtras>();
  for (let i = 0; i < qids.length; i += KINDS_BATCH) {
    for (const [qid, value] of parseExtras(await sparql(extrasQuery(qids.slice(i, i + KINDS_BATCH)), fetcher))) extras.set(qid, value);
  }
  const photos = await fetchCardPhotos(
    [...extras.values()].flatMap((e) => e.file ?? []),
    { fetcher },
  );
  const enrich = (p: StoredPlace): StoredPlace => {
    const rest: StoredPlace = { ...p };
    delete rest.photo;
    delete rest.description;
    const extra = p.wikidataId ? extras.get(p.wikidataId) : undefined;
    const photo = extra?.file ? photos.get(extra.file) : undefined;
    return { ...rest, ...(photo ? { photo } : {}), ...(extra?.description ? { description: extra.description.slice(0, 200) } : {}) };
  };
  return {
    ...file,
    categories: Object.fromEntries(
      Object.entries(file.categories).map(([id, c]) => [id, c.status === "ok" ? { ...c, places: c.places.map(enrich) } : c]),
    ) as PlacesFile["categories"],
  };
}

/**
 * srcset for a stored card photo: the same Commons thumbnail at the standard widths no wider than the original
 * (Commons refuses larger ones). Empty when the stored src is the original itself (no "/NNNpx-" thumbnail).
 */
export function cardPhotoSrcSet(photo: Pick<CardPhoto, "src" | "width" | "fullWidth">): string {
  if (!/\/\d+px-/.test(photo.src)) return "";
  const max = photo.fullWidth ?? photo.width;
  const widths = CARD_PHOTO_WIDTHS.filter((w) => w <= max);
  return widths.map((w) => `${photo.src.replace(/\/\d+px-/, `/${w}px-`)} ${w}w`).join(", ");
}
