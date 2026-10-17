import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PlanSections } from "@/components/plan/PlanSections";
import { CityMasthead } from "@/components/city/CityMasthead";
import { PlanSummary } from "@/components/plan/PlanSummary";
import { SearchForm } from "@/components/search/SearchForm";
import { Caption, Skeleton, SkeletonTicket } from "@/components/ui";
import { findDestination } from "@/data/destinations";
import { todayInIstanbul } from "@/lib/search/dates";
import { describeSearch } from "@/lib/search/describe";
import { parseBudgetParams } from "@/lib/budget/params";
import { parseDirect } from "@/lib/flights/display";
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
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-10 md:px-8 md:pt-16">
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
      <>
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
      </>
    );
  }

  const destination = findDestination(result.value.to)!;
  return (
    <>
      <CityMasthead destination={destination} />
      <div className="mt-10">
        <PlanSummary search={result.value} />
      </div>
      <PlanSections
        search={result.value}
        categories={parseCategories(params.cats)}
        direct={parseDirect(params.direct)}
        budget={parseBudgetParams(params, destination.currency)}
      />
    </>
  );
}

function PlanFallback() {
  return (
    <div aria-busy="true">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mb-8 mt-4 h-12 w-64 md:h-16" />
      <SkeletonTicket label="Plan yükleniyor" />
    </div>
  );
}
