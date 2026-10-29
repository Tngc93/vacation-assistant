import { formatMessage, type MessageValues } from "./format";
import { INTL_LOCALE, type Locale } from "./locales";
import type { Messages } from "./messages/tr";

export type { Messages };

/** A language's messages and its formatter: `m.home.title`, `f(m.plan.nights, { count: 4 })`. */
export type I18n = {
  locale: Locale;
  /** The Intl locale: "tr-TR" or "en-GB". */
  intl: string;
  m: Messages;
  f: (template: string, values?: MessageValues) => string;
};

export function createI18n(locale: Locale, messages: Messages): I18n {
  return { locale, intl: INTL_LOCALE[locale], m: messages, f: (template, values) => formatMessage(locale, template, values) };
}
