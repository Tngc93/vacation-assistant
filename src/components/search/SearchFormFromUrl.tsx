"use client";

import { useSearchParams } from "next/navigation";
import { todayInIstanbul } from "@/lib/search/dates";
import { hasRouteParams, parseSearch } from "@/lib/search/params";
import { SearchForm } from "./SearchForm";

/**
 * Pre-fills the form from the URL (the "Düzenle" link on /plan). Renders only
 * on the client inside <Suspense>, so the home page keeps a static shell.
 */
export function SearchFormFromUrl() {
  const params = useSearchParams();
  if (!hasRouteParams(params) && !params.has("from") && !params.has("pax")) return <SearchForm />;

  const result = parseSearch(params, todayInIstanbul(new Date()));
  const initial = result.ok ? result.value : result.draft;
  // Only surface problems with values that were actually in the link.
  const issues = result.ok ? [] : result.issues.filter((issue) => params.has(issue.field));
  return <SearchForm key={params.toString()} initial={initial} initialIssues={issues} />;
}
