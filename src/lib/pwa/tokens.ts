/**
 * Colour tokens read from globals.css, the one place raw values live, for the places CSS variables cannot reach:
 * the web app manifest, `<meta name="theme-color">` and the generated app icons. Import-free, so the icon script
 * (scripts/generate-icons.mts) can use it outside Next.js.
 */
export const THEME_SCHEMES = ["light", "dark"] as const;
export type ThemeScheme = (typeof THEME_SCHEMES)[number];

/** The token blocks of globals.css: light is `:root`, dark the manual `[data-theme="dark"]` copy of the system one. */
const SELECTORS: Record<ThemeScheme, string> = { light: ":root", dark: ':root[data-theme="dark"]' };

export type ThemeTokens = Record<string, string>;

/** `--name: #rrggbb;` declarations of a scheme's block, lower-cased. */
export function readThemeTokens(css: string, scheme: ThemeScheme): ThemeTokens {
  const selector = `${SELECTORS[scheme]} {`;
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`globals.css has no ${selector} block`);
  const block = css.slice(start, css.indexOf("}", start));
  const tokens: ThemeTokens = {};
  for (const [, name, value] of block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)) tokens[name] = value.toLowerCase();
  return tokens;
}

/** A token of a scheme, or an error naming it (a renamed token must not silently drop a colour). */
export function themeToken(css: string, scheme: ThemeScheme, name: string): string {
  const value = readThemeTokens(css, scheme)[name];
  if (!value) throw new Error(`globals.css has no ${scheme} value for --${name}`);
  return value;
}
