import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { en } from "@/i18n/messages/en";
import { tr } from "@/i18n/messages/tr";
import { APP_ICONS, manifestPath, webManifest } from "./manifest";
import { readThemeTokens, themeToken } from "./tokens";

const ROOT = path.resolve(__dirname, "../../..");
const css = readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");
const light = readThemeTokens(css, "light");

/** Width and height from a PNG's IHDR chunk. */
function pngSize(file: Buffer): { width: number; height: number } {
  expect(file.subarray(1, 4).toString("latin1")).toBe("PNG");
  return { width: file.readUInt32BE(16), height: file.readUInt32BE(20) };
}
const publicFile = (src: string) => readFileSync(path.join(ROOT, "public", src));

describe("web app manifest", () => {
  it.each([
    ["tr", tr, "/"],
    ["en", en, "/en"],
  ] as const)("%s: installs standalone from its own start page, over the whole site", (locale, messages, start) => {
    const manifest = webManifest(locale, light);
    expect(manifest).toMatchObject({
      id: start,
      name: "Vacationist",
      short_name: "Vacationist",
      description: messages.pwa.description,
      lang: locale,
      start_url: start,
      scope: "/",
      display: "standalone",
      orientation: "any",
    });
    expect(manifestPath(locale)).toBe(locale === "tr" ? "/manifest.webmanifest" : "/en/manifest.webmanifest");
  });

  it("takes its colours from the light theme's tokens", () => {
    const manifest = webManifest("tr", light);
    expect(manifest.theme_color).toBe(themeToken(css, "light", "paper"));
    expect(manifest.background_color).toBe(themeToken(css, "light", "paper"));
    expect(readThemeTokens(css, "dark").paper).not.toBe(light.paper);
  });

  it("lists 192 and 512 icons and a maskable 512, each the size it says", () => {
    const icons = webManifest("tr", light).icons ?? [];
    expect(icons.map((i) => [i.sizes, i.purpose])).toEqual([
      ["192x192", "any"],
      ["512x512", "any"],
      ["512x512", "maskable"],
    ]);
    for (const icon of icons) {
      const [width, height] = icon.sizes!.split("x").map(Number);
      expect(pngSize(publicFile(icon.src))).toEqual({ width, height });
    }
  });

  it("has a 180 Apple touch icon and a favicon with 16, 32 and 48", () => {
    expect(pngSize(publicFile(APP_ICONS.apple180))).toEqual({ width: 180, height: 180 });
    const ico = readFileSync(path.join(ROOT, "src/app/favicon.ico"));
    const count = ico.readUInt16LE(4);
    const sizes = Array.from({ length: count }, (_, i) => ico.readUInt8(6 + 16 * i));
    expect(sizes).toEqual([16, 32, 48]);
  });
});
