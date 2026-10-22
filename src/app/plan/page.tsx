import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PlanSections } from "@/components/plan/PlanSections";
import { PlanHero, PlanHeroSkeleton } from "@/components/plan/PlanHero";
import { PlanNav } from "@/components/plan/PlanNav";
import { SearchForm } from "@/components/search/SearchForm";
import { Caption } from "@/components/ui";
import { findDestination } from "@/data/destinations";
import { formatDay } from "@/lib/format";
import { isoToDate } from "@/lib/search/dates";
import { todayInIstanbul } from "@/lib/search/dates";
import { describeSearch } from "@/lib/search/describe";
import { parseBudgetParams } from "@/lib/budget/params";
import { parseDirect } from "@/lib/flights/display";
import { parseEdits, parsePinned } from "@/lib/ai/edits";
import { parseSkip } from "@/lib/itinerary/ids";
import { parseCategories } from "@/lib/places/cats";
import { parseSearch } from "@/lib/search/params";

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
    return { title: "Plan", description: "Rotanı seç: kalkış, varış, tarihler ve yolcu sayısı.", robots: { index: false } };
  }
  const { title, description } = describeSearch(result.value);
  return { title, description, openGraph: { title, description }, robots: { index: false } };
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
    const hasAnyParam = Object.values(params).some((v) => v !== undefined && v !== "");
    return (
      <div className="pt-10 md:pt-16">
        <Caption as="p">Plan</Caption>
        <h1 className="mt-3 font-display text-headline">
          {hasAnyParam ? "Bu bağlantıdaki rota tamamlanmamış." : "Önce bir rota seç."}
        </h1>
        <p className="mb-8 mt-4 max-w-xl text-body text-ink-muted">
          {hasAnyParam
            ? "Eksik ya da geçersiz bilgileri düzelt; geçerli olanları senin için doldurduk."
            : "Kalkış, varış, tarihler ve yolcu sayısını seçtiğinde plan burada açılır."}
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
        <PlanHero search={result.value} destination={destination} categories={categories} />
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
