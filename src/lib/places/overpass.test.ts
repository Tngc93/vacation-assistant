import { describe, expect, it, vi } from "vitest";
import { boundingBox, buildOverpassQuery, distanceKm, OVERPASS_ENDPOINTS, runOverpass, USER_AGENT, type Fetcher } from "./overpass";

describe("buildOverpassQuery", () => {
  it("writes one statement per exact filter inside a bounding box of the city radius", () => {
    expect(buildOverpassQuery("see", 41.3825, 2.1769, 3)).toBe(
      [
        "[out:json][timeout:25][bbox:41.3556,2.141,41.4094,2.2128];",
        "(",
        '  nwr["tourism"="attraction"]["name"];',
        '  nwr["historic"="monument"]["name"];',
        '  nwr["historic"="castle"]["name"];',
        '  nwr["historic"="ruins"]["name"];',
        '  nwr["historic"="archaeological_site"]["name"];',
        ");",
        "out tags center 400;",
      ].join("\n"),
    );
  });

  it("queries cocktail bars by any of the three cocktail tags", () => {
    const query = buildOverpassQuery("cocktail", 43.8564, 18.4131, 2);
    expect(query).toContain('nwr["amenity"="bar"]["cocktails"="yes"]["name"];');
    expect(query).toContain('nwr["amenity"="bar"]["bar"="cocktail"]["name"];');
    expect(query).toContain('nwr["amenity"="bar"]["drink:cocktail"="yes"]["name"];');
  });

  it("is deterministic per city and category, and distinct across them (stable cache keys)", () => {
    expect(buildOverpassQuery("museum", 41.38251, 2.17689, 3)).toBe(buildOverpassQuery("museum", 41.3825, 2.1769, 3));
    expect(buildOverpassQuery("museum", 41.3825, 2.1769, 3)).not.toBe(buildOverpassQuery("cafe", 41.3825, 2.1769, 3));
    expect(buildOverpassQuery("museum", 41.3825, 2.1769, 3)).not.toBe(buildOverpassQuery("museum", 43.8564, 18.4131, 3));
  });
});

describe("geometry", () => {
  it("builds a box that contains the radius", () => {
    const [s, w, n, e] = boundingBox(41.3825, 2.1769, 3);
    expect(distanceKm(41.3825, 2.1769, n, 2.1769)).toBeCloseTo(3, 1);
    expect(distanceKm(41.3825, 2.1769, 41.3825, e)).toBeCloseTo(3, 1);
    expect(s).toBeLessThan(41.3825);
    expect(w).toBeLessThan(2.1769);
  });

  it("measures distances on the sphere", () => {
    // Barcelona centre to Sagrada Família is about 2.2 km.
    expect(distanceKm(41.3825, 2.1769, 41.4036, 2.1744)).toBeCloseTo(2.35, 1);
  });
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("runOverpass", () => {
  it("posts the query with a descriptive User-Agent", async () => {
    const fetcher = vi.fn<Fetcher>(async () => json({ elements: [] }));
    await runOverpass("[out:json];node(1);out;", { fetcher });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(OVERPASS_ENDPOINTS[0]);
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("User-Agent")).toBe(USER_AGENT);
    expect(new URLSearchParams(String(init.body)).get("data")).toBe("[out:json];node(1);out;");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("falls back to the next endpoint on HTTP errors and on error remarks", async () => {
    const replies = [
      new Response("busy", { status: 502 }),
      json({ elements: [], remark: "runtime error: Query timed out in \"query\" at line 3 after 25 seconds." }),
      json({ elements: [{ type: "node", id: 1, lat: 1, lon: 2 }] }),
    ];
    const fetcher = vi.fn<Fetcher>(async () => replies.shift()!);
    await expect(runOverpass("q", { fetcher })).resolves.toEqual([{ type: "node", id: 1, lat: 1, lon: 2 }]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("gives up on a slow endpoint and tries the next", async () => {
    let call = 0;
    const fetcher: Fetcher = (_url, init) =>
      call++ === 0
        ? new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(init.signal?.reason)))
        : Promise.resolve(json({ elements: [] }));
    await expect(runOverpass("q", { fetcher, timeoutMs: 20 })).resolves.toEqual([]);
  });

  it("throws when every endpoint fails, naming each failure", async () => {
    const fetcher: Fetcher = async () => new Response("down", { status: 500 });
    await expect(runOverpass("q", { fetcher })).rejects.toThrow(/All Overpass endpoints failed.*HTTP 500/);
  });
});
