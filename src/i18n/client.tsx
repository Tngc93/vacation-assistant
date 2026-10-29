"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createI18n, type I18n, type Messages } from "./i18n";
import type { Locale } from "./locales";

const I18nContext = createContext<I18n | null>(null);

/** Set by the test setup only: components rendered without the provider read Turkish. */
let fallback: I18n | null = null;
export function setFallbackI18n(i18n: I18n | null): void {
  fallback = i18n;
}

/** The root layout's provider: the page's language and only that language's messages. */
export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: ReactNode }) {
  const value = useMemo(() => createI18n(locale, messages), [locale, messages]);
  return <I18nContext value={value}>{children}</I18nContext>;
}

/** Client components: the page's language, its messages and formatter. */
export function useI18n(): I18n {
  const i18n = useContext(I18nContext) ?? fallback;
  if (!i18n) throw new Error("useI18n needs <I18nProvider> (the root layout has it)");
  return i18n;
}
