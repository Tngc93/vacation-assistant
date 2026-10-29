import type { NextRequest } from "next/server";
import { cityName, countryName, findDestination } from "@/data/destinations";
import { getI18n } from "@/i18n/server";
import { formatDay } from "@/lib/format";
import { renderOgCard } from "@/lib/og/image";
import { daysBetween, isIsoDate, isoToDate } from "@/lib/search/dates";
import { brandOgCard } from "../../_shell/homeOgImage";

/**
 * The card a shared plan link previews with: the city and the dates, in the plan's language (`lang=en` for /en/plan).
 * It reads only `to`, `depart`, `return` and `lang` (no "today" check, so an old link still previews its trip);
 * anything it can't read gives the brand card.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const locale = params.get("lang") === "en" ? "en" : "tr";
  const { m, f } = getI18n(locale);
  const destination = findDestination(params.get("to") ?? "");
  const depart = params.get("depart") ?? "";
  const ret = params.get("return") ?? "";

  if (!destination) return brandOgCard(locale, m.og.plan);
  const dated = isIsoDate(depart) && isIsoDate(ret) && depart <= ret;
  const country = countryName(destination, locale);
  return renderOgCard({
    locale,
    eyebrow: dated ? f(m.og.planCountryNights, { country, nights: daysBetween(depart, ret) }) : f(m.og.planCountry, { country }),
    title: cityName(destination, locale),
    subtitle: dated ? `${formatDay(isoToDate(depart), locale)} – ${formatDay(isoToDate(ret), locale)}` : undefined,
  });
}
