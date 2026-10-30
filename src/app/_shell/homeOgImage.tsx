import type { Locale } from "@/i18n/locales";
import { getI18n } from "@/i18n/server";
import { BRAND_NAME, SITE_URL } from "@/lib/brand";
import { renderOgCard } from "@/lib/og/image";

export const homeOgAlt = (locale: Locale) => `${BRAND_NAME} · ${getI18n(locale).m.brand.tagline}`;

/** The brand card, the home page's and a plan link's that cannot be read. */
export function brandOgCard(locale: Locale, eyebrow?: string) {
  const { m } = getI18n(locale);
  return renderOgCard({
    locale,
    eyebrow: eyebrow ?? m.og.eyebrow,
    title: BRAND_NAME,
    subtitle: m.brand.tagline,
    footnote: m.og.footnote,
    signature: new URL(SITE_URL).host,
  });
}
