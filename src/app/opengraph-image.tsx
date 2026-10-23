import { BRAND_NAME, BRAND_TAGLINE, SITE_URL } from "@/lib/brand";
import { renderOgCard } from "@/lib/og/image";
import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/size";

export const alt = `${BRAND_NAME} · ${BRAND_TAGLINE}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgCard({
    eyebrow: "Uçuş · konaklama · gün gün plan · TL bütçe",
    title: BRAND_NAME,
    subtitle: BRAND_TAGLINE,
    footnote: "İstanbul · Ankara çıkışlı",
    signature: new URL(SITE_URL).host,
  });
}
