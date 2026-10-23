import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readTokenBlock } from "@/test/contrast";
import { readPalette } from "./image";

const css = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");

describe("Open Graph palette", () => {
  it("is the light theme from globals.css", () => {
    const light = readTokenBlock(css, ":root");
    expect(readPalette(css)).toEqual({
      paper: light.paper,
      ink: light.ink,
      "ink-muted": light["ink-muted"],
      rule: light.rule,
      accent: light.accent,
    });
  });

  it("fails loudly when a token is missing", () => {
    expect(() => readPalette(":root { --paper: #ffffff; }")).toThrow(/--ink/);
  });
});
