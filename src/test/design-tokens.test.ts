import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { StampTone } from "@/components/ui";
import { contrastRatio, readTokenBlock } from "./contrast";

const SRC = path.resolve(__dirname, "..");
const css = readFileSync(path.join(SRC, "app/globals.css"), "utf8");

const themes = {
  light: readTokenBlock(css, ":root"),
  "dark (system)": readTokenBlock(css, ':root:not([data-theme="light"])'),
  "dark (manual)": readTokenBlock(css, ':root[data-theme="dark"]'),
};

const TOKENS = ["paper", "paper-raised", "ink", "ink-muted", "rule", "accent", "accent-ink", "sea", "ok", "warn"];

// Text-on-background pairs the components actually use. AA for normal text is 4.5:1.
const TEXT_PAIRS: ReadonlyArray<[fg: string, bg: string]> = [
  ["ink", "paper"],
  ["ink", "paper-raised"],
  ["ink-muted", "paper"],
  ["ink-muted", "paper-raised"],
  ["accent", "paper"],
  ["accent", "paper-raised"],
  ["accent-ink", "accent"],
  ["paper-raised", "ink"],
  ["sea", "paper"],
  ["sea", "paper-raised"],
  ["ok", "paper"],
  ["ok", "paper-raised"],
  ["warn", "paper"],
  ["warn", "paper-raised"],
];

describe("design tokens", () => {
  it.each(Object.entries(themes))("%s theme defines every token", (_, tokens) => {
    expect(Object.keys(tokens).sort()).toEqual([...TOKENS].sort());
  });

  it("system dark and manual dark are identical", () => {
    expect(themes["dark (system)"]).toEqual(themes["dark (manual)"]);
  });

  describe.each(Object.entries(themes))("%s theme", (_, tokens) => {
    it.each(TEXT_PAIRS)("%s on %s passes WCAG AA (4.5:1)", (fg, bg) => {
      expect(contrastRatio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(4.5);
    });

    it("focus ring (accent) is at least 3:1 against the page", () => {
      expect(contrastRatio(tokens.accent, tokens.paper)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(tokens.accent, tokens["paper-raised"])).toBeGreaterThanOrEqual(3);
    });
  });
});

// Each visa stamp tone and the token it prints in; stamps sit on paper and paper-raised.
const STAMP_TONE_TOKENS: Record<StampTone, string> = { ok: "ok", sea: "sea", warn: "warn", muted: "ink-muted" };

describe.each(Object.entries(themes))("visa stamp tones, %s theme", (_, tokens) => {
  it.each(Object.entries(STAMP_TONE_TOKENS))("%s (--%s) passes WCAG AA on paper and paper-raised", (_, token) => {
    expect(contrastRatio(tokens[token], tokens.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens[token], tokens["paper-raised"])).toBeGreaterThanOrEqual(4.5);
  });
});

describe("no raw colours outside globals.css", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(tsx?|css)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
        files.push(full);
      }
    }
  };
  walk(SRC);

  it.each(files.filter((f) => !f.endsWith(path.join("app", "globals.css"))).map((f) => path.relative(SRC, f)))(
    "%s uses tokens only",
    (file) => {
      const source = readFileSync(path.join(SRC, file), "utf8");
      expect(source).not.toMatch(/#[0-9a-f]{3,8}\b(?![-\w])/i);
      expect(source).not.toMatch(/\b(rgb|hsl|oklch)a?\(/i);
    },
  );
});
