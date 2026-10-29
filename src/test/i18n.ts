import { createI18n } from "@/i18n/i18n";
import { en } from "@/i18n/messages/en";
import { tr } from "@/i18n/messages/tr";

/** The two languages' messages and formatters, for tests of functions that take them. */
export const TR = createI18n("tr", tr);
export const EN = createI18n("en", en);
