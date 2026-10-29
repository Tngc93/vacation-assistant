import { z } from "zod";

/**
 * src/data/origins.json: every city with a scheduled large or medium airport (OurAirports), grouped by IATA
 * metropolitan code or municipality, with Turkish and English names from Wikidata and time zones from GeoNames. Written by
 * `npm run data:origins` (src/lib/origins/build.ts); read only on the server (src/lib/origins/data.ts).
 * Version 2 (2026-10-29): no Travelpayouts-derived data (version 1 was built from its static files).
 * Version 3 (2026-10-29): English names (`nameEn`) of cities and airports for the English interface.
 */
export const ORIGINS_FILE_VERSION = 3;

const iata = z.string().regex(/^[A-Z]{3}$/);

export const storedOriginSchema = z.object({
  /** IATA metropolitan code (IST, LON, NYC), a destination's city code, or the airport's code (ESB for Ankara). */
  code: iata,
  /** Turkish name shown in the interface (see build.ts for the order of sources). */
  name: z.string().min(1),
  /** English name, only when it differs from `name` ("London" for "Londra"). */
  nameEn: z.string().min(1).optional(),
  /** ISO 3166-1 alpha-2. */
  country: z.string().regex(/^[A-Z]{2}$/),
  /** IANA zone of the city: flight times are local to each airport. */
  timeZone: z.string().min(1),
  /** Scheduled airports, by code; names from Wikidata (Turkish, then English), else OurAirports. */
  airports: z.array(z.object({ code: iata, name: z.string().min(1), nameEn: z.string().min(1).optional() })).min(1),
  /** Other names searched but not shown: English, local, other spellings. */
  aliases: z.array(z.string().min(1)).optional(),
});

export type StoredOrigin = z.infer<typeof storedOriginSchema>;

export const originsFileSchema = z.object({
  version: z.literal(ORIGINS_FILE_VERSION),
  fetchedAt: z.string(),
  sources: z.array(z.object({ name: z.string(), url: z.string().url(), terms: z.string() })),
  /** Best known first (Wikipedia languages of the city's Wikidata item), so search ties go to the better known city. */
  cities: z.array(storedOriginSchema),
});

export type OriginsFile = z.infer<typeof originsFileSchema>;
