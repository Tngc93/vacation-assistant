import { z } from "zod";
import { storedPhotoSchema } from "@/lib/places/file";

/**
 * Shape of src/data/events/<CODE>.json: the city's big recurring events (festivals, carnivals, fairs, Christmas
 * markets, film and music festivals), fetched ahead of time from Wikidata by `npm run data:events`. The app only
 * reads these files; it never queries Wikidata at request time.
 */
export const EVENTS_FILE_VERSION = 1;

export const EVENT_TYPES = ["christmasMarket", "carnival", "film", "music", "fair", "festival"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  christmasMarket: "Noel pazarı",
  carnival: "Karnaval",
  film: "Film festivali",
  music: "Müzik festivali",
  fair: "Panayır",
  festival: "Festival",
};

const isoDate = z.iso.date();
const qid = z.string().regex(/^Q[1-9]\d*$/);

/** One yearly edition with day-precise dates on Wikidata (P580/P582, or P585 for a single day). */
export const editionSchema = z
  .object({ qid, start: isoDate, end: isoDate })
  .refine((e) => e.start <= e.end, "an edition ends after it starts");

export const storedEventSchema = z
  .object({
    /** The recurring event's Wikidata item (the series, not an edition). */
    qid,
    /** names.ts: Turkish label, else English; never a non-Latin name when a Latin one exists. */
    name: z.string().min(1),
    localName: z.string().min(1).optional(),
    type: z.enum(EVENT_TYPES),
    /** Wikipedia language editions with an article: the ranking, and the threshold that drops minor events. */
    wikipedias: z.number().int().positive(),
    /** Exact: editions within the 18 months from the fetch, earliest first. */
    editions: z.array(editionSchema).min(1).optional(),
    /**
     * Approximate, only when no edition has exact dates: the series' months (P2922, or P837 when it names a
     * month or a day of one), 1–12 in calendar order. Shown as "GENELDE EYLÜL–EKİM", never as dates.
     */
    months: z.array(z.number().int().min(1).max(12)).min(1).max(6).optional(),
    /** The one venue (P276) that is a place rather than the city or a district, with its coordinates. */
    venue: z
      .object({ qid, name: z.string().min(1), lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) })
      .optional(),
    /** Official website (P856). */
    website: z.url({ protocol: /^https?$/ }).optional(),
    /** Wikidata P18 on Commons, licence-filtered like the city photo. */
    photo: storedPhotoSchema.extend({ fullWidth: z.number().int().positive().optional() }).optional(),
  })
  .refine((e) => Boolean(e.editions) !== Boolean(e.months), "exact editions or approximate months, never both or neither");

export const eventsFileSchema = z.object({
  version: z.literal(EVENTS_FILE_VERSION),
  cityCode: z.string().regex(/^[A-Z]{3}$/),
  fetchedAt: z.iso.datetime(),
  /** The sitelink threshold the file was fetched with (MIN_EVENT_WIKIPEDIAS). */
  minWikipedias: z.number().int().positive(),
  license: z.object({ name: z.literal("CC0-1.0"), url: z.literal("https://creativecommons.org/publicdomain/zero/1.0/") }),
  /** Most known first. */
  events: z.array(storedEventSchema),
});

export type StoredEvent = z.infer<typeof storedEventSchema>;
export type EventEdition = z.infer<typeof editionSchema>;
export type EventsFile = z.infer<typeof eventsFileSchema>;
