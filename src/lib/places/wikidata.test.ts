import { describe, expect, it, vi } from "vitest";
import sitelinks from "./__fixtures__/wikidata-sitelinks.json";
import type { Fetcher } from "./overpass";
import { countWikipedias, fetchWikipediaCounts, wikidataBatchUrls } from "./wikidata";

describe("Wikipedia language count", () => {
  it("counts only Wikipedia editions", () => {
    expect(countWikipedias(sitelinks.entities.Q1046553.sitelinks)).toBe(4);
    expect(countWikipedias(sitelinks.entities.Q861252.sitelinks)).toBe(6);
    expect(countWikipedias(undefined)).toBe(0);
  });

  it("batches IDs by 50, deduplicated and sorted, ignoring malformed ones", () => {
    const ids = [...Array.from({ length: 120 }, (_, i) => `Q${i + 1}`), "Q1", "q5", "Q0", "nope"];
    const urls = wikidataBatchUrls(ids);
    expect(urls).toHaveLength(3);
    const batch = (u: string) => new URL(u).searchParams.get("ids")!.split("|");
    expect(batch(urls[0])).toHaveLength(50);
    expect(batch(urls[2])).toHaveLength(20);
    expect(new URL(urls[0]).searchParams.get("props")).toBe("sitelinks");
    expect(urls.flatMap(batch)).not.toContain("q5");
  });

  it("returns counts per ID and throws when Wikidata fails", async () => {
    const ok = vi.fn<Fetcher>(async () => new Response(JSON.stringify(sitelinks)));
    const counts = await fetchWikipediaCounts(["Q1046553", "Q861252"], { fetcher: ok });
    expect(Object.fromEntries(counts)).toEqual({ Q1046553: 4, Q861252: 6 });
    expect(new Headers(ok.mock.calls[0][1].headers).get("User-Agent")).toMatch(/^VacationAssistant\/0\.1 \(https:\/\/github\.com/);

    const down: Fetcher = async () => new Response("{}", { status: 503 });
    await expect(fetchWikipediaCounts(["Q1"], { fetcher: down })).rejects.toThrow(/503/);
    await expect(fetchWikipediaCounts([], { fetcher: down })).resolves.toEqual(new Map());
  });
});
