import { searchOrigins } from "@/lib/origins/data";

/**
 * GET /api/origins?q=lon → up to 8 departure cities ({ code, name, countryTr, airports }). The origin combobox
 * asks here so the ~3,500-city list never ships to the browser. Same answer for the same query, so it is cached.
 */
export function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  return Response.json(
    { results: searchOrigins(q) },
    { headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400" } },
  );
}
