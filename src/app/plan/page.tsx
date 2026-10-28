import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PlanSections } from "@/components/plan/PlanSections";
import { PlanHero, PlanHeroSkeleton } from "@/components/plan/PlanHero";
import { PlanNav } from "@/components/plan/PlanNav";
import { SearchForm } from "@/components/search/SearchForm";
import { Caption } from "@/components/ui";
import { findDestination } from "@/data/destinations";
import { BRAND_NAME } from "@/lib/brand";
import { formatDay } from "@/lib/format";
import { isoToDate } from "@/lib/search/dates";
import { todayInIstanbul } from "@/lib/search/dates";
import { describeSearch, formatDateRange } from "@/lib/search/describe";
import { OG_SIZE } from "@/lib/og/size";
import { parseBudgetParams } from "@/lib/budget/params";
import { parseDirect } from "@/lib/flights/display";
import { parseEdits, parsePinned } from "@/lib/ai/edits";
import { parseSkip } from "@/lib/itinerary/ids";
import { parseCategories, parseShowEvents } from "@/lib/places/cats";
import { hasRouteParams, parseSearch } from "@/lib/search/params";

type Props = Pick<PageProps<"/plan">, "searchParams">;

async function readSearch(searchParams: Props["searchParams"]) {
  const params = await searchParams;
  // "Today" belongs to the request, not to the build.
  await connection();
  return { params, result: parseSearch(params, todayInIstanbul(new Date())) };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { result } = await readSearch(searchParams);
  if (!result.ok) {
    return { title: "Plan", description: "Planı açmak için varış şehrini ve tarihleri seç.", robots: { index: false } };
  }
  const { title, description } = describeSearch(result.value);
  const { to, depart, return: ret } = result.value;
  const image = {
    url: `/og/plan?${new URLSearchParams({ to, depart, return: ret })}`,
    ...OG_SIZE,
    alt: `${findDestination(to)?.nameTr ?? "Plan"} · ${formatDateRange(depart, ret)}`,
  };
  return {
    title,
    description,
    // Child metadata replaces these objects whole, so the site name is repeated here.
    openGraph: { type: "website", locale: "tr_TR", siteName: BRAND_NAME, title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
    // Shared plans preview (Open Graph above) but are not indexed; robots.txt leaves /plan crawlable so the
    // link-preview bots can read this.
    robots: { index: false },
  };
}

export default function PlanPage({ searchParams }: Props) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 md:px-8">
      <Suspense fallback={<PlanFallback />}>
        <PlanContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function PlanContent({ searchParams }: Props) {
  const { params, result } = await readSearch(searchParams);

  if (!result.ok) {
    // Only the destination and the dates make a link "incomplete"; the origin and the group have defaults.
    const hasAnyParam = hasRouteParams(params);
    return (
      <div className="pt-10 md:pt-16">
        <Caption as="p">Plan</Caption>
        <h1 className="mt-3 font-display text-headline">
          {hasAnyParam ? "Bu bağlantıdaki rota tamamlanmamış." : "Önce bir rota seç."}
        </h1>
        <p className="mb-8 mt-4 max-w-xl text-body text-ink-muted">
          {hasAnyParam
            ? "Eksik ya da geçersiz bilgileri düzelt; geçerli olanları senin için doldurduk."
            : "Varış şehrini ve tarihleri seçtiğinde plan burada açılır."}
        </p>
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
        <Caption as="p">Plan · {destination.countryTr}</Caption>
        <h1 className="mt-2 font-display text-headline">{destination.nameTr}</h1>
        <p className="mt-2 font-mono text-caption tabular">
          {formatDay(isoToDate(result.value.depart))} → {formatDay(isoToDate(result.value.return))} · {result.value.pax} kişi
        </p>
      </header>
      <Suspense fallback={<PlanHeroSkeleton />}>
        <PlanHero search={result.value} destination={destination} categories={categories} showEvents={parseShowEvents(params.cats)} />
      </Suspense>
      <PlanNav />
      <PlanSections
        search={result.value}
        categories={categories}
        direct={parseDirect(params.direct)}
        budget={parseBudgetParams(params, destination.currency)}
        planEdits={{ skip: parseSkip(params.skip), ai: parsePinned(params.ai), edits: parseEdits(params.edit) }}
      />
    </>
  );
}

function PlanFallback() {
  return <PlanHeroSkeleton />;
}
