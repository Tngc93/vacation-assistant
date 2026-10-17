import { z } from "zod";
import { CATEGORY_IDS } from "./categories";

/**
 * Shape of src/data/places/<CODE>.json: place data fetched ahead of time by
 * `npm run data:places`. The app only reads these files; it never queries
 * Overpass, Wikidata or Commons at request time.
 */

export const PLACES_FILE_VERSION = 1;

export const ODBL = {
  name: "ODbL-1.0",
  url: "https://opendatacommons.org/licenses/odbl/1-0/",
  attribution: "© OpenStreetMap katkıcıları",
} as const;

const coordinate = (min: number, max: number) => z.number().min(min).max(max);

export const storedPlaceSchema = z.object({
  id: z.string().regex(/^(node|way|relation)\/\d+$/),
  name: z.string().min(1),
  localName: z.string().min(1).optional(),
  lat: coordinate(-90, 90),
  lon: coordinate(-180, 180),
  address: z.string().min(1).optional(),
  website: z.url({ protocol: /^https?$/ }).optional(),
  openingHours: z.string().min(1).optional(),
  cuisine: z.string().min(1).optional(),
  wikipediaCount: z.number().int().positive().optional(),
  detailed: z.literal(true).optional(),
});

export const MAX_STORED_PER_CATEGORY = 30;

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
    usedFor: "Vikipedi dil sayıları, şehir fotoğrafı (P18)",
  },
  {
    name: "Wikimedia Commons",
    url: "https://commons.wikimedia.org",
    license: "fotoğraf başına (CC0, kamu malı, CC BY, CC BY-SA)",
    usedFor: "şehir fotoğrafı ve atıf bilgisi",
  },
];
