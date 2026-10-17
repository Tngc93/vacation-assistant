import { describe, expect, it } from "vitest";
import { loadPlacesFile } from "./load";

describe("loadPlacesFile", () => {
  it("reads a city's pre-fetched file", async () => {
    const file = await loadPlacesFile("mle");
    expect(file?.cityCode).toBe("MLE");
    expect(file?.categories.restaurant.status).toBeDefined();
  });

  it("returns null for unknown or malformed codes instead of throwing", async () => {
    await expect(loadPlacesFile("XXX")).resolves.toBeNull();
    await expect(loadPlacesFile("../etc")).resolves.toBeNull();
  });
});
