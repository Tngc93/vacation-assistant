import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORIES, type CategoryId } from "./categories";
import { placesFileSchema } from "./file";
import { sameNameOnce } from "./twins";

describe("stored place files", () => {
  const dir = path.join(process.cwd(), "src/data/places");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

  it.each(files)("%s lists every sight once", (file) => {
    const data = placesFileSchema.parse(JSON.parse(readFileSync(path.join(dir, file), "utf8")));
    for (const [id, category] of Object.entries(data.categories)) {
      if (category.status !== "ok" || CATEGORIES[id as CategoryId].ranking !== "wikipedia") continue;
      expect(sameNameOnce(category.places)).toEqual(category.places);
    }
  });
});
