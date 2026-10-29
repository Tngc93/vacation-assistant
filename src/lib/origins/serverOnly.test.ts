import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const src = path.join(__dirname, "..", "..");
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
const code = (file: string) => readFileSync(file, "utf8");

// The ~3,500 departure cities stay on the server; `npm run check:bundle` checks the built client bundle too.
describe("the origins list stays on the server", () => {
  it("is imported only by the server-only module that searches it", () => {
    expect(code(path.join(__dirname, "data.ts")).startsWith('import "server-only";')).toBe(true);
    const importers = walk(src).filter((f) => !/\.test\.tsx?$/.test(f) && /from ["'][^"']*origins\.json["']/.test(code(f)));
    expect(importers.map((f) => path.relative(src, f))).toEqual([path.join("lib", "origins", "data.ts")]);
  });

  it("is never reached from a client component", () => {
    const clientFiles = walk(src).filter((f) => /^["']use client["']/.test(code(f)));
    expect(clientFiles.length).toBeGreaterThan(5);
    for (const file of clientFiles) {
      expect(code(file), path.relative(src, file)).not.toMatch(/lib\/origins\/(data|build|source)|data\/origins\.json/);
    }
    // The browser's own origin module carries types, the default and storage helpers, no list.
    expect(code(path.join(src, "data", "origins.ts"))).not.toMatch(/import .*origins\.json|"LHR"|"SAW"/);
  });
});
