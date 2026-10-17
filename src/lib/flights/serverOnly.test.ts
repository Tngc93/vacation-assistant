import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const src = path.join(__dirname, "..", "..");
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
  });

// Modules that see the Travelpayouts token (or decide whether to call the API).
const SECRET_MODULES = ["client", "search", "fixtures"];

describe("the Travelpayouts token stays on the server", () => {
  it("is read only behind `server-only`", () => {
    for (const name of SECRET_MODULES) {
      const code = readFileSync(path.join(__dirname, `${name}.ts`), "utf8");
      expect(code.startsWith('import "server-only";'), `${name}.ts`).toBe(true);
    }
    const readers = walk(src).filter((f) => !f.endsWith(".test.ts") && readFileSync(f, "utf8").includes("TRAVELPAYOUTS_TOKEN"));
    expect(readers.map((f) => path.relative(src, f))).toEqual([path.join("lib", "flights", "client.ts")]);
  });

  it("is never imported by a client component", () => {
    const clientFiles = walk(src).filter((f) => /^["']use client["']/.test(readFileSync(f, "utf8")));
    expect(clientFiles.length).toBeGreaterThan(5);
    for (const file of clientFiles) {
      expect(readFileSync(file, "utf8"), path.relative(src, file)).not.toMatch(/lib\/flights\/(client|search|fixtures)|NEXT_PUBLIC_TRAVELPAYOUTS/);
    }
  });
});
