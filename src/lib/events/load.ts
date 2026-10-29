import "server-only";
import { cache } from "react";
import type { Locale } from "@/i18n/locales";
import { eventName, eventsFileSchema, type EventsFile } from "./file";

/**
 * Reads src/data/events/<CODE>.json on the server. Never queries Wikidata; a missing or invalid file simply means
 * "no events known". Event and venue names are in the interface language (their English labels in English).
 */
export const loadEventsFile = cache(async (cityCode: string, locale: Locale = "tr"): Promise<EventsFile | null> => {
  const code = cityCode.toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return null;
  try {
    const mod = (await import(`../../data/events/${code}.json`)) as { default: unknown };
    const parsed = eventsFileSchema.safeParse(mod.default);
    if (!parsed.success) return null;
    if (locale === "tr") return parsed.data;
    return {
      ...parsed.data,
      events: parsed.data.events.map((event) => ({
        ...event,
        name: eventName(event, locale),
        ...(event.venue ? { venue: { ...event.venue, name: event.venue.nameEn ?? event.venue.name } } : {}),
      })),
    };
  } catch {
    return null;
  }
});
