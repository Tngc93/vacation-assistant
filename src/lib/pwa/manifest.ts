import type { MetadataRoute } from "next";
import { localePath, type Locale } from "@/i18n/locales";
import { getI18n } from "@/i18n/server";
import { BRAND_NAME } from "@/lib/brand";
import type { ThemeTokens } from "./tokens";

/** Where each language's manifest is served; the root layouts link their own (RootDocument). */
export function manifestPath(locale: Locale): string {
  return localePath(locale, "/manifest.webmanifest");
}

/** The generated icons (scripts/generate-icons.mts). */
export const APP_ICONS = {
  any192: "/icons/icon-192.png",
  any512: "/icons/icon-512.png",
  maskable512: "/icons/icon-maskable-512.png",
  apple180: "/icons/apple-touch-icon.png",
} as const;

/**
 * The web app manifest of a language. One manifest per language, told apart by `start_url` (and so by `id`): an
 * English install opens /en, a Turkish one /. Both keep the whole site as their scope, so the TR / EN switch
 * stays inside the installed app. A manifest has one colour each; the dark theme's colour reaches the browser
 * through `<meta name="theme-color" media>` (RootDocument).
 */
export function webManifest(locale: Locale, light: ThemeTokens): MetadataRoute.Manifest {
  const { m } = getI18n(locale);
  const start = localePath(locale, "/");
  return {
    id: start,
    name: BRAND_NAME,
    short_name: BRAND_NAME,
    description: m.pwa.description,
    lang: locale,
    dir: "ltr",
    start_url: start,
    scope: "/",
    display: "standalone",
    orientation: "any",
    theme_color: light.paper,
    background_color: light.paper,
    categories: ["travel"],
    icons: [
      { src: APP_ICONS.any192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: APP_ICONS.any512, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: APP_ICONS.maskable512, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
