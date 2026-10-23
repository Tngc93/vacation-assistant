import type { NextRequest } from "next/server";
import { findDestination } from "@/data/destinations";
import { BRAND_NAME, BRAND_TAGLINE, SITE_URL } from "@/lib/brand";
import { formatDay } from "@/lib/format";
import { renderOgCard } from "@/lib/og/image";
import { daysBetween, isIsoDate, isoToDate } from "@/lib/search/dates";

/**
 * The card a shared plan link previews with: the city and the dates. It reads only `to`, `depart` and `return`
 * (no "today" check, so an old link still previews its trip); anything it can't read gives the brand card.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const destination = findDestination(params.get("to") ?? "");
  const depart = params.get("depart") ?? "";
  const ret = params.get("return") ?? "";

  if (!destination) {
    return renderOgCard({
      eyebrow: "Plan",
      title: BRAND_NAME,
      subtitle: BRAND_TAGLINE,
      footnote: "İstanbul · Ankara çıkışlı",
      signature: new URL(SITE_URL).host,
    });
  }
  const dated = isIsoDate(depart) && isIsoDate(ret) && depart <= ret;
  const nights = dated ? daysBetween(depart, ret) : 0;
  return renderOgCard({
    eyebrow: dated ? `Plan · ${destination.countryTr} · ${nights} gece` : `Plan · ${destination.countryTr}`,
    title: destination.nameTr,
    subtitle: dated ? `${formatDay(isoToDate(depart))} – ${formatDay(isoToDate(ret))}` : undefined,
  });
}
