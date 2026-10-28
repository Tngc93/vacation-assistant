import "server-only";
import { cache } from "react";
import { eventsFileSchema, type EventsFile } from "./file";

/**
 * Reads src/data/events/<CODE>.json on the server. Never queries Wikidata; a missing or invalid file simply means
 * "no events known".
 */
export const loadEventsFile = cache(async (cityCode: string): Promise<EventsFile | null> => {
  const code = cityCode.toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return null;
  try {
    const mod = (await import(`../../data/events/${code}.json`)) as { default: unknown };
    const parsed = eventsFileSchema.safeParse(mod.default);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
});
