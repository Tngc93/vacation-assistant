import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { en } from "@/i18n/messages/en";
import { tr } from "@/i18n/messages/tr";
import { webManifest } from "@/lib/pwa/manifest";
import { BRAND_NAME, SITE_URL } from "./brand";

const OLD_NAME = /vacation\s+assistant/i;
const SRC = path.resolve(__dirname, "..");
const ROOT = path.resolve(SRC, "..");
// Spelled in parts so this file is not a hit itself.
const OLD_HOST = ["vacation-assistant", "nine.vercel.app"].join("-");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) return name === "places" && dir.endsWith("data") ? [] : sourceFiles(file);
    return /\.(tsx?|css|json)$/.test(name) ? [file] : [];
  });
}

/** Every file git tracks or would track (untracked but not ignored), text only. */
function repoTextFiles(): string[] {
  return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: ROOT, encoding: "utf8" })
    .split("\0")
    .filter(Boolean)
    .filter((file) => {
      try {
        return !readFileSync(path.join(ROOT, file)).includes(0);
      } catch {
        return false; // listed but deleted in the working tree
      }
    });
}

describe("brand", () => {
  it("is Vacationist with its tagline", () => {
    expect(BRAND_NAME).toBe("Vacationist");
    expect(tr.brand.tagline).toBe("Kısa şehir kaçamakları için planlayıcı");
    expect(tr.brand.description.startsWith(tr.brand.tagline)).toBe(true);
    expect(en.brand.tagline).toBe("A planner for short city breaks");
    expect(en.brand.description.startsWith(en.brand.tagline)).toBe(true);
  });

  it("names the web manifest in both languages", () => {
    for (const [locale, messages] of [["tr", tr], ["en", en]] as const) {
      const m = webManifest(locale, { paper: "" });
      expect(m.name).toBe(BRAND_NAME);
      expect(m.short_name).toBe(BRAND_NAME);
      expect(m.description).toBe(messages.pwa.description);
      expect(messages.pwa.description.startsWith(messages.brand.tagline)).toBe(true);
    }
  });

  it("leaves the old name nowhere in the app's source (the slug and the VacationAssistant User-Agent stay)", () => {
    const self = path.resolve(__dirname, "brand.test.ts");
    const hits = sourceFiles(SRC)
      .filter((file) => file !== self && OLD_NAME.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(SRC, file));
    expect(hits).toEqual([]);
  });

  it("uses the live address for absolute URLs", () => {
    expect(SITE_URL).toBe("https://vacationist-app.vercel.app");
  });

  it("leaves the old production address only in the redirect note in docs/DEPLOY.md", () => {
    const hits = repoTextFiles().flatMap((file) =>
      readFileSync(path.join(ROOT, file), "utf8")
        .split("\n")
        .filter((line) => line.includes(OLD_HOST))
        .map((line) => ({ file, line })),
    );
    expect(hits).toHaveLength(1);
    expect(hits[0].file).toBe("docs/DEPLOY.md");
    expect(hits[0].line).toContain(SITE_URL);
    expect(hits[0].line).toMatch(/yönlenir/);
  });
});
