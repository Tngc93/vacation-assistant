import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PlanSections } from "@/components/plan/PlanSections";
import { PlanHero, PlanHeroSkeleton } from "@/components/plan/PlanHero";
import { PlanNav } from "@/components/plan/PlanNav";
import { SearchForm } from "@/components/search/SearchForm";
import { Caption } from "@/components/ui";
import { cityName, countryName, findDestination } from "@/data/destinations";
import { languageAlternates } from "@/i18n/alternates";
import { OG_LOCALE, type Locale } from "@/i18n/locales";
import { getI18n } from "@/i18n/server";
import { BRAND_NAME } from "@/lib/brand";
import { formatDay } from "@/lib/format";
import { isoToDate } from "@/lib/search/dates";
import { todayInIstanbul } from "@/lib/search/dates";
import { describeSearch, formatDateRange } from "@/lib/search/describe";
import { OG_SIZE } from "@/lib/og/size";
import { parseBudgetCurrency } from "@/lib/budget/currency";
import { parseBudgetParams } from "@/lib/budget/params";
import { parseDirect } from "@/lib/flights/display";
import { parseEdits, parsePinned } from "@/lib/ai/edits";
import { parseSkip } from "@/lib/itinerary/ids";
import { parseCategories, parseShowEvents } from "@/lib/places/cats";
import { resolveOrigin } from "@/lib/origins/data";
import { hasRouteParams, parseSearch } from "@/lib/search/params";

type Props = Pick<PageProps<"/plan">, "searchParams">;
type LocaleProps = Props & { locale: Locale };

async function readSearch(searchParams: Props["searchParams"], locale: Locale) {
  const params = await searchParams;
  // "Today" belongs to the request, not to the build.
  await connection();
  const result = parseSearch(params, todayInIstanbul(new Date()));
  // `?from=` names a known city from here on: an airport code becomes its city (SAW → IST), an unknown code İstanbul.
  if (result.ok) result.value.from = resolveOrigin(result.value.from, locale).code;
  return { params, result };
}

/** The plan's metadata in a language: its title, description, Open Graph card and the other language's address. */
export async function planMetadata({ searchParams, locale }: LocaleProps): Promise<Metadata> {
  const i18n = getI18n(locale);
  const { m } = i18n;
  const { params, result } = await readSearch(searchParams, locale);
  const query = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => [k, x]) : v === undefined ? [] : [[k, v]])),
  ).toString();
  const alternates = languageAlternates(locale, "/plan", query);
  if (!result.ok) {
    return { title: m.plan.title, description: m.plan.pickToOpen, robots: { index: false }, alternates };
  }
  const { title, description } = describeSearch(result.value, i18n);
  const { to, depart, return: ret } = result.value;
  const destination = findDestination(to);
  const image = {
    url: `/og/plan?${new URLSearchParams({ to, depart, return: ret, ...(locale === "tr" ? {} : { lang: locale }) })}`,
    ...OG_SIZE,
    alt: `${destination ? cityName(destination, locale) : m.plan.title} · ${formatDateRange(depart, ret, i18n.intl)}`,
  };
  return {
    title,
    description,
    alternates,
    // Child metadata replaces these objects whole, so the site name is repeated here.
    openGraph: { type: "website", locale: OG_LOCALE[locale], siteName: BRAND_NAME, title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
    // Shared plans preview (Open Graph above) but are not indexed; robots.txt leaves /plan crawlable so the
    // link-preview bots can read this.
    robots: { index: false },
  };
}

export function PlanPage({ searchParams, locale }: LocaleProps) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 md:px-8">
      <Suspense fallback={<PlanFallback locale={locale} />}>
        <PlanContent searchParams={searchParams} locale={locale} />
      </Suspense>
    </div>
  );
}

async function PlanContent({ searchParams, locale }: LocaleProps) {
  const { m, f } = getI18n(locale);
  const { params, result } = await readSearch(searchParams, locale);

  if (!result.ok) {
    // Only the destination and the dates make a link "incomplete"; the origin and the group have defaults.
    const hasAnyParam = hasRouteParams(params);
    return (
      <div className="pt-10 md:pt-16">
        <Caption as="p">{m.plan.title}</Caption>
        <h1 className="mt-3 font-display text-headline">{hasAnyParam ? m.plan.incompleteTitle : m.plan.emptyTitle}</h1>
        <p className="mb-8 mt-4 max-w-xl text-body text-ink-muted">{hasAnyParam ? m.plan.incompleteLead : m.plan.emptyLead}</p>
        <SearchForm initial={result.draft} initialIssues={hasAnyParam ? result.issues : []} />
      </div>
    );
  }

  const destination = findDestination(result.value.to)!;
  const categories = parseCategories(params.cats);
  return (
    <>
      {/* Printed instead of the hero: the city and the dates above the plan and the budget. */}
      <header className="hidden print:block">
        <Caption as="p">{f(m.og.planCountry, { country: countryName(destination, locale) })}</Caption>
        <h1 className="mt-2 font-display text-headline">{cityName(destination, locale)}</h1>
        <p className="mt-2 font-mono text-caption tabular">
          {formatDay(isoToDate(result.value.depart), locale)} → {formatDay(isoToDate(result.value.return), locale)} ·{" "}
          {f(m.search.peopleCount, { count: result.value.pax })}
        </p>
      </header>
      <Suspense fallback={<PlanHeroSkeleton locale={locale} />}>
        <PlanHero
          locale={locale}
          search={result.value}
          destination={destination}
          categories={categories}
          showEvents={parseShowEvents(params.cats)}
          budgetCurrency={parseBudgetCurrency(params.cur)}
        />
      </Suspense>
      <PlanNav />
      <PlanSections
        locale={locale}
        search={result.value}
        categories={categories}
        direct={parseDirect(params.direct)}
        budget={parseBudgetParams(params, destination.currency)}
        planEdits={{ skip: parseSkip(params.skip), ai: parsePinned(params.ai), edits: parseEdits(params.edit) }}
      />
    </>
  );
}

function PlanFallback({ locale }: { locale: Locale }) {
  return <PlanHeroSkeleton locale={locale} />;
}
