import "server-only";
import { createI18n, type I18n } from "./i18n";
import type { Locale } from "./locales";
import { en } from "./messages/en";
import { tr, type Messages } from "./messages/tr";

export type { Messages };

/** Both dictionaries stay on the server; a page hands its language's messages to the client provider. */
export const MESSAGES: Record<Locale, Messages> = { tr, en };

const cache = new Map<Locale, I18n>();

/** Server components and route handlers: the language's messages and formatter. */
export function getI18n(locale: Locale): I18n {
  let i18n = cache.get(locale);
  if (!i18n) {
    i18n = createI18n(locale, MESSAGES[locale]);
    cache.set(locale, i18n);
  }
  return i18n;
}

/** Sections only server components read; the client dictionary leaves them out (each page would carry them). */
const SERVER_ONLY_SECTIONS = ["privacy"] as const satisfies ReadonlyArray<keyof Messages>;

/**
 * The language's messages for `<I18nProvider>`: everything but the server-only sections (the privacy page's long
 * copy). Typed as Messages so the client types stay one; no client component reads those sections.
 */
const clientCache = new Map<Locale, Messages>();
export function clientMessages(locale: Locale): Messages {
  let messages = clientCache.get(locale);
  if (!messages) {
    const copy: Partial<Messages> = { ...MESSAGES[locale] };
    for (const section of SERVER_ONLY_SECTIONS) delete copy[section];
    messages = copy as Messages;
    clientCache.set(locale, messages);
  }
  return messages;
}
