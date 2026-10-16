import { externalFetch } from "@/lib/net";
import { USER_AGENT, type Fetcher } from "@/lib/places/overpass";

export const PHOTO_TIMEOUT_MS = 8_000;
export const PHOTO_WIDTH = 1280;

export type CityPhoto = {
  src: string;
  width: number;
  height: number;
  /** Plain-text author, from Commons "Artist" (or "Credit"). */
  author: string;
  license: string;
  /** Licence deed; for public-domain files, the file page. */
  licenseUrl: string;
  /** Commons file page. */
  fileUrl: string;
};

/** Licences we may show: CC0, public domain, CC BY and CC BY-SA (any version). */
export function isAllowedLicense(license: string | undefined, shortName?: string): boolean {
  const code = (license ?? "").trim().toLowerCase();
  if (/^(cc0|pd|pd-.+|public domain)$/.test(code)) return true;
  if (/^cc-by(-sa)?-\d(\.\d)?(-[a-z]+)?$/.test(code)) return true;
  // Fall back to the human-readable name when the machine code is missing.
  const short = (shortName ?? "").trim().toLowerCase();
  return /^(cc0( 1\.0)?|public domain)$/.test(short) || /^cc by(-sa)? \d(\.\d)?( [a-z]+)?$/.test(short);
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };

/** Commons "Artist" is HTML; keep the visible text only. */
export function plainText(html: string | undefined): string {
  return (html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#\d+|[a-z]+);/gi, (m, e: string) =>
      e.startsWith("#") && !(e in ENTITIES) ? String.fromCodePoint(Number(e.slice(1))) : (ENTITIES[e.toLowerCase()] ?? m),
    )
    .replace(/\s+/g, " ")
    .trim();
}

/** "Fotoğraf: dronepicr · CC BY 2.0 · Wikimedia Commons · renkleri düzenlendi" (the duotone is a change CC BY asks us to mention). */
export function attributionText(photo: Pick<CityPhoto, "author" | "license">): string {
  return `Fotoğraf: ${photo.author} · ${photo.license} · Wikimedia Commons · renkleri düzenlendi`;
}

function preferredP18(json: unknown): string | null {
  const claims = (json as { claims?: { P18?: Array<{ rank?: string; mainsnak?: { datavalue?: { value?: unknown } } }> } })
    ?.claims?.P18;
  if (!claims?.length) return null;
  const claim = claims.find((c) => c.rank === "preferred") ?? claims.find((c) => c.rank === "normal");
  const value = claim?.mainsnak?.datavalue?.value;
  return typeof value === "string" && value.trim() ? value : null;
}

type ImageInfo = {
  thumburl?: string;
  thumbwidth?: number;
  thumbheight?: number;
  descriptionurl?: string;
  extmetadata?: Record<string, { value?: string } | undefined>;
};

/** Commons thumb URL without tracking parameters. */
function cleanThumbUrl(url: string): string {
  const u = new URL(url);
  u.search = "";
  return u.toString();
}

/** Builds a CityPhoto from Commons imageinfo, or null when the licence is not allowed or data is missing. */
export function photoFromImageInfo(info: ImageInfo | undefined): CityPhoto | null {
  const meta = info?.extmetadata ?? {};
  const license = meta.License?.value;
  const short = plainText(meta.LicenseShortName?.value);
  if (!info?.thumburl || !info.descriptionurl || !info.thumbwidth || !info.thumbheight) return null;
  if (!isAllowedLicense(license, short)) return null;
  const host = new URL(info.thumburl).hostname;
  if (host !== "upload.wikimedia.org" && host !== "thumb.wikimedia.org") return null;

  const author = plainText(meta.Artist?.value) || plainText(meta.Credit?.value) || "Bilinmeyen fotoğrafçı";
  return {
    src: cleanThumbUrl(info.thumburl),
    width: info.thumbwidth,
    height: info.thumbheight,
    author,
    license: short || license!.toUpperCase(),
    licenseUrl: meta.LicenseUrl?.value?.replace(/^http:/, "https:") || info.descriptionurl,
    fileUrl: info.descriptionurl,
  };
}

/** Wikidata P18 → Commons imageinfo. Returns null when there is no usable photo; throws on network failure. */
export async function fetchCityPhoto(
  wikidataId: string,
  { fetcher = externalFetch, timeoutMs = PHOTO_TIMEOUT_MS }: { fetcher?: Fetcher; timeoutMs?: number } = {},
): Promise<CityPhoto | null> {
  const init = () => ({ headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(timeoutMs) });
  const claimsUrl = `https://www.wikidata.org/w/api.php?${new URLSearchParams({
    action: "wbgetclaims",
    entity: wikidataId,
    property: "P18",
    format: "json",
  })}`;
  const claimsRes = await fetcher(claimsUrl, init());
  if (!claimsRes.ok) throw new Error(`Wikidata HTTP ${claimsRes.status}`);
  const file = preferredP18(await claimsRes.json());
  if (!file) return null;

  const infoUrl = `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({
    action: "query",
    titles: `File:${file}`,
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: String(PHOTO_WIDTH),
    iiextmetadatafilter: "License|LicenseShortName|LicenseUrl|Artist|Credit",
    format: "json",
    formatversion: "2",
  })}`;
  const infoRes = await fetcher(infoUrl, init());
  if (!infoRes.ok) throw new Error(`Commons HTTP ${infoRes.status}`);
  const json = (await infoRes.json()) as { query?: { pages?: Array<{ imageinfo?: ImageInfo[] }> } };
  return photoFromImageInfo(json.query?.pages?.[0]?.imageinfo?.[0]);
}
