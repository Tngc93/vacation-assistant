import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { INTL_LOCALE, type Locale } from "@/i18n/locales";
import { BRAND_NAME } from "@/lib/brand";
import { OG_SIZE } from "./size";

/**
 * Open Graph cards: typography and the light palette only, no photo (a shared link previews the same in every
 * app). The colours are read from globals.css, the one place raw values live; the fonts are the OFL Fraunces and
 * Geist Mono files in assets/og (Satori reads woff, not the woff2 next/font serves). Latin and latin-ext are
 * separate files, so Turkish letters (ğ, ı, İ, ş) fall back from the first to the second.
 */
const TOKENS = ["paper", "ink", "ink-muted", "rule", "accent"] as const;
type Palette = Record<(typeof TOKENS)[number], string>;

/** Light-theme token values from the `:root { … }` block of globals.css. */
export function readPalette(css: string): Palette {
  const start = css.indexOf(":root {");
  const block = css.slice(start, css.indexOf("}", start));
  const palette = {} as Palette;
  for (const token of TOKENS) {
    const value = new RegExp(`--${token}:\\s*(#[0-9a-f]{6})\\s*;`, "i").exec(block)?.[1];
    if (!value) throw new Error(`globals.css has no light value for --${token}`);
    palette[token] = value;
  }
  return palette;
}

async function loadAssets() {
  // Static paths, so the tracer ships just these files with the function.
  const [css, display, displayExt, mono, monoExt] = await Promise.all([
    readFile(join(process.cwd(), "src/app/globals.css"), "utf8"),
    readFile(join(process.cwd(), "assets/og/fraunces-latin-400-normal.woff")),
    readFile(join(process.cwd(), "assets/og/fraunces-latin-ext-400-normal.woff")),
    readFile(join(process.cwd(), "assets/og/geist-mono-latin-400-normal.woff")),
    readFile(join(process.cwd(), "assets/og/geist-mono-latin-ext-400-normal.woff")),
  ]);
  return {
    palette: readPalette(css),
    fonts: [
      { name: "Fraunces", data: display, weight: 400 as const, style: "normal" as const },
      { name: "Fraunces", data: displayExt, weight: 400 as const, style: "normal" as const },
      { name: "Geist Mono", data: mono, weight: 400 as const, style: "normal" as const },
      { name: "Geist Mono", data: monoExt, weight: 400 as const, style: "normal" as const },
    ],
  };
}


type Card = {
  /** The card's language: the uppercase lines follow its rules (Turkish "İ"). */
  locale: Locale;
  /** Small mono line on top. */
  eyebrow: string;
  /** The big Fraunces line. */
  title: string;
  /** A second, quieter line under the title. */
  subtitle?: string;
  /** Mono line at the bottom right. */
  footnote?: string;
  /** Bottom left: the wordmark, or the site's address when the title already is the brand. */
  signature?: string;
};

export async function renderOgCard({ locale, eyebrow, title, subtitle, footnote, signature = BRAND_NAME }: Card): Promise<ImageResponse> {
  const { palette, fonts } = await loadAssets();
  const upper = (text: string) => text.toLocaleUpperCase(INTL_LOCALE[locale]);
  const mono = { fontFamily: "Geist Mono", fontSize: 22, letterSpacing: "0.08em", color: palette["ink-muted"] };
  const titleSize = title.length > 14 ? 112 : 148;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          backgroundColor: palette.paper,
          color: palette.ink,
          fontFamily: "Fraunces",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, ...mono }}>
          <div style={{ width: 14, height: 14, backgroundColor: palette.accent }} />
          {upper(eyebrow)}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: titleSize, lineHeight: 1, letterSpacing: "-0.03em" }}>{title}</div>
          {subtitle ? (
            <div style={{ marginTop: 28, fontSize: 40, lineHeight: 1.2, color: palette["ink-muted"] }}>{subtitle}</div>
          ) : null}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            paddingTop: 28,
            borderTop: `1px solid ${palette.rule}`,
          }}
        >
          {signature === BRAND_NAME ? (
            <div style={{ fontSize: 34, letterSpacing: "-0.01em" }}>{signature}</div>
          ) : (
            <div style={{ ...mono, color: palette.ink, letterSpacing: "0.02em" }}>{signature}</div>
          )}
          <div style={mono}>{footnote ? upper(footnote) : null}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
