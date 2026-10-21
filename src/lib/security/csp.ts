/**
 * Content-Security-Policy for every page. The browser may only connect to our own origin, the map tiles
 * (OpenFreeMap: style, tiles, glyphs) and the three AI providers, so a user's key cannot be sent anywhere else
 * from this site. Kept import-light so next.config.ts can read it.
 */
import { AI_ORIGINS } from "../ai/origins";

/** OpenFreeMap serves the style, the vector tiles, the glyphs and the sprites from this one origin. */
export const MAP_TILES_ORIGIN = "https://tiles.openfreemap.org";
/** City photos: Wikimedia Commons, loaded as images (never fetched by scripts). */
const IMAGE_ORIGINS = ["https://upload.wikimedia.org", "https://thumb.wikimedia.org"];

export function contentSecurityPolicy({ dev }: { dev: boolean }): string {
  const connect = ["'self'", MAP_TILES_ORIGIN, ...Object.values(AI_ORIGINS), ...(dev ? ["ws:", "wss:"] : [])];
  return [
    "default-src 'self'",
    // Next.js inlines its bootstrap scripts; development also evaluates code for fast refresh.
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${IMAGE_ORIGINS.join(" ")}`,
    "font-src 'self'",
    `connect-src ${connect.join(" ")}`,
    // MapLibre's worker is served from /vendor and may start from a blob.
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
