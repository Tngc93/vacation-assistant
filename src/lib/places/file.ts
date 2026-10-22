import { z } from "zod";
import { CATEGORY_IDS } from "./categories";
import { KIND_TAGS } from "./kinds";

/**
 * Shape of src/data/places/<CODE>.json: place data fetched ahead of time by
 * `npm run data:places`. The app only reads these files; it never queries
 * Overpass, Wikidata or Commons at request time.
 */

/**
 * 3: Wikidata must-sees stored as raw candidates with their kinds; the sight rules run on read (rules.ts).
 * 4: card photos (Wikidata P18, Commons author and licence) and short descriptions for places with an item.
 */
export const PLACES_FILE_VERSION = 4;

export const ODBL = {
  name: "ODbL-1.0",
  url: "https://opendatacommons.org/licenses/odbl/1-0/",
  attribution: "© OpenStreetMap katkıcıları",
} as const;

const coordinate = (min: number, max: number) => z.number().min(min).max(max);

export const storedPlaceSchema = z.object({
  /** OSM object, or a Wikidata item for a must-see place OSM does not have ("wikidata/Q207870"). */
  id: z.string().regex(/^((node|way|relation)\/\d+|wikidata\/Q[1-9]\d*)$/),
  name: z.string().min(1),
  localName: z.string().min(1).optional(),
  lat: coordinate(-90, 90),
  lon: coordinate(-180, 180),
  address: z.string().min(1).optional(),
  website: z.url({ protocol: /^https?$/ }).optional(),
  openingHours: z.string().min(1).optional(),
  cuisine: z.string().min(1).optional(),
  wikipediaCount: z.number().int().positive().optional(),
  /** Wikidata item, for sights, museums and viewpoints that have one. */
  wikidataId: z.string().regex(/^Q[1-9]\d*$/).optional(),
  /** ISO country code, only when it is not the destination's (the Vatican, seen from Rome). */
  country: z.string().regex(/^[A-Z]{2}$/).optional(),
  /**
   * Wikidata kinds (kinds.ts): the place's P31 classes the sight rules use, plus "heritage" (any P1435) and
   * "unesco". Raw data: rules.ts decides on read what is a sight and what is walked through.
   */
  kinds: z.array(z.enum(KIND_TAGS)).min(1).optional(),
  detailed: z.literal(true).optional(),
  /** Wikidata P18 on Commons, licence-filtered like the city photo (photos.ts). */
  photo: z.lazy(() => cardPhotoSchema).optional(),
  /** Wikidata description, Turkish first, then English. */
  description: z.string().min(1).max(200).optional(),
});

/**
 * Sights and museums show 40 (the must-see list), the other categories 30. A file may hold more: the
 * candidates the sight rules leave out stay in it, so a rule change needs no refetch.
 */
export const MAX_STORED_PER_CATEGORY = 80;

const categorySchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    wikipediaCountsAvailable: z.boolean(),
    places: z.array(storedPlaceSchema).max(MAX_STORED_PER_CATEGORY),
  }),
  z.object({ status: z.literal("missing"), reason: z.string().min(1) }),
]);

export const storedPhotoSchema = z.object({
  src: z.url().refine((u) => /^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(u), "Commons CDN only"),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  author: z.string().min(1),
  license: z.string().min(1),
  licenseUrl: z.url(),
  fileUrl: z.url(),
});

/** A card photo: a 500px Commons thumbnail; `fullWidth` (the original's) caps srcset. */
const cardPhotoSchema = storedPhotoSchema.extend({ fullWidth: z.number().int().positive().optional() });

export const placesFileSchema = z.object({
  version: z.literal(PLACES_FILE_VERSION),
  cityCode: z.string().regex(/^[A-Z]{3}$/),
  fetchedAt: z.iso.datetime(),
  radiusKm: z.number().positive(),
  license: z.object({ name: z.literal(ODBL.name), url: z.literal(ODBL.url), attribution: z.literal(ODBL.attribution) }),
  sources: z
    .array(z.object({ name: z.string().min(1), url: z.url(), license: z.string().min(1), usedFor: z.string().min(1) }))
    .min(1),
  photo: storedPhotoSchema.nullable(),
  categories: z.record(z.enum(CATEGORY_IDS), categorySchema),
});

export type StoredPlace = z.infer<typeof storedPlaceSchema>;
export type StoredPhoto = z.infer<typeof storedPhotoSchema>;
export type PlacesFile = z.infer<typeof placesFileSchema>;
export type StoredCategory = PlacesFile["categories"][keyof PlacesFile["categories"]];

export const SOURCES: PlacesFile["sources"] = [
  {
    name: "OpenStreetMap (Overpass API)",
    url: "https://www.openstreetmap.org/copyright",
    license: "ODbL-1.0",
    usedFor: "mekânlar, adresler, açılış saatleri",
  },
  {
    name: "Wikidata",
    url: "https://www.wikidata.org",
    license: "CC0-1.0",
    usedFor: "önemli yerler (Wikidata Query Service), Vikipedi dil sayıları, şehir ve mekân fotoğrafları (P18), kısa açıklamalar",
  },
  {
    name: "Wikimedia Commons",
    url: "https://commons.wikimedia.org",
    license: "fotoğraf başına (CC0, kamu malı, CC BY, CC BY-SA)",
    usedFor: "şehir ve mekân fotoğrafları ve atıf bilgisi",
  },
];
