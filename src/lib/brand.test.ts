import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { BRAND_DESCRIPTION, BRAND_NAME, BRAND_TAGLINE } from "./brand";

const OLD_NAME = /vacation\s+assistant/i;
const SRC = path.resolve(__dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) return name === "places" && dir.endsWith("data") ? [] : sourceFiles(file);
    return /\.(tsx?|css|json)$/.test(name) ? [file] : [];
  });
}

describe("brand", () => {
  it("is Vacationist with its tagline", () => {
    expect(BRAND_NAME).toBe("Vacationist");
    expect(BRAND_TAGLINE).toBe("Kısa şehir kaçamakları için planlayıcı");
    expect(BRAND_DESCRIPTION.startsWith(BRAND_TAGLINE)).toBe(true);
  });

  it("names the web manifest", () => {
    const m = manifest();
    expect(m.name).toBe(BRAND_NAME);
    expect(m.short_name).toBe(BRAND_NAME);
    expect(m.description).toBe(BRAND_DESCRIPTION);
  });

  it("leaves the old name nowhere in the app's source (the slug and the VacationAssistant User-Agent stay)", () => {
    const self = path.resolve(__dirname, "brand.test.ts");
    const hits = sourceFiles(SRC)
      .filter((file) => file !== self && OLD_NAME.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(SRC, file));
    expect(hits).toEqual([]);
  });
});
