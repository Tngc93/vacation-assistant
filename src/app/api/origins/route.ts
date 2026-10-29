import { searchOrigins } from "@/lib/origins/data";

/**
 * GET /api/origins?q=lon&lang=en → up to 8 departure cities ({ code, name, countryName, airports }), named in the
 * interface language (Turkish without `lang`). The origin combobox
 * asks here so the ~3,500-city list never ships to the browser. Same answer for the same query, so it is cached.
 */
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = params.get("q") ?? "";
  return Response.json(
    { results: searchOrigins(q, undefined, params.get("lang") === "en" ? "en" : "tr") },
    { headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400" } },
  );
}
