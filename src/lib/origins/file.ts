import { z } from "zod";

/**
 * src/data/origins.json: every city with an airport open to flights, from Travelpayouts' static data (the same
 * city and airport codes as the price API), with Turkish names from Wikidata. Written by `npm run data:origins`
 * (src/lib/origins/build.ts); read only on the server (src/lib/origins/data.ts).
 */
export const ORIGINS_FILE_VERSION = 1;

const iata = z.string().regex(/^[A-Z]{3}$/);

export const storedOriginSchema = z.object({
  /** IATA city code (IST, LON, NYC, ANK); for a one-airport city often the airport's code too. */
  code: iata,
  /** Turkish name shown in the interface (see build.ts for the order of sources). */
  name: z.string().min(1),
  /** ISO 3166-1 alpha-2. */
  country: z.string().regex(/^[A-Z]{2}$/),
  /** IANA zone of the city: flight times are local to each airport. */
  timeZone: z.string().min(1),
  /** Airports open to flights, IATA order of Travelpayouts' file; names as Travelpayouts gives them in Turkish. */
  airports: z.array(z.object({ code: iata, name: z.string().min(1) })).min(1),
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
