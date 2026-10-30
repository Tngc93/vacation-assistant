import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readThemeTokens, type ThemeScheme, type ThemeTokens } from "./tokens";

/** Both schemes' tokens, read once from globals.css (a static path, so the tracer ships the file). */
export const THEME_TOKENS: Record<ThemeScheme, ThemeTokens> = (() => {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  return { light: readThemeTokens(css, "light"), dark: readThemeTokens(css, "dark") };
})();
