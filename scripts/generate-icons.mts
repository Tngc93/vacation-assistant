/**
 * The app icons: a Fraunces "V" (the wordmark's face) in accent-ink on the accent, the site's one strong colour.
 * Writes public/icons/ (192 and 512 for the manifest, a maskable 512, the 180 Apple touch icon) and
 * src/app/favicon.ico (16, 32, 48). Colours come from globals.css (light theme), the font from assets/og (OFL), so
 * `npm run icons` reproduces the committed files; run it after changing either.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { createElement as h } from "react";
import { themeToken } from "../src/lib/pwa/tokens";

const root = process.cwd();
const css = await readFile(join(root, "src/app/globals.css"), "utf8");
const accent = themeToken(css, "light", "accent");
const accentInk = themeToken(css, "light", "accent-ink");
const fraunces = await readFile(join(root, "assets/og/fraunces-latin-400-normal.woff"));

type Shape = {
  size: number;
  /** "tile": a rounded square on transparency (manifest "any", favicon); "full": edge to edge (maskable, Apple). */
  shape: "tile" | "full";
  /** The letter's cap height as a share of the icon: maskable icons keep it inside the 80% safe zone. */
  letter: number;
};

async function render({ size, shape, letter }: Shape): Promise<Buffer> {
  // Fraunces' cap height is ~0.7 em; the letter sits a touch high in its line box, so it is nudged down.
  const fontSize = (size * letter) / 0.7;
  const image = new ImageResponse(
    h(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: accent,
          borderRadius: shape === "tile" ? size * 0.22 : 0,
        },
      },
      h(
        "div",
        {
          style: {
            display: "flex",
            fontFamily: "Fraunces",
            fontSize,
            lineHeight: 1,
            color: accentInk,
            marginTop: fontSize * 0.08,
          },
        },
        "V",
      ),
    ),
    { width: size, height: size, fonts: [{ name: "Fraunces", data: fraunces, weight: 400, style: "normal" }] },
  );
  return Buffer.from(await image.arrayBuffer());
}

/** An .ico whose entries are PNGs (supported by every browser that reads favicons). */
function ico(pngs: ReadonlyArray<{ size: number; data: Buffer }>): Buffer {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, data }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...pngs.map((p) => p.data)]);
}

const TILE = 0.5;
const FILES: ReadonlyArray<{ path: string } & Shape> = [
  { path: "public/icons/icon-192.png", size: 192, shape: "tile", letter: TILE },
  { path: "public/icons/icon-512.png", size: 512, shape: "tile", letter: TILE },
  { path: "public/icons/icon-maskable-512.png", size: 512, shape: "full", letter: 0.36 },
  { path: "public/icons/apple-touch-icon.png", size: 180, shape: "full", letter: 0.46 },
];

await mkdir(join(root, "public/icons"), { recursive: true });
for (const { path, ...shape } of FILES) {
  await writeFile(join(root, path), await render(shape));
  console.log(`${path} · ${shape.size}×${shape.size}`);
}
const favicon = await Promise.all(
  [16, 32, 48].map(async (size) => ({ size, data: await render({ size, shape: "tile", letter: 0.58 }) })),
);
await writeFile(join(root, "src/app/favicon.ico"), ico(favicon));
console.log("src/app/favicon.ico · 16, 32, 48");
