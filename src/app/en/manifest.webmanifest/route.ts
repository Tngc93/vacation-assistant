import { webManifest } from "@/lib/pwa/manifest";
import { THEME_TOKENS } from "@/lib/pwa/theme";

/** The English web app manifest (start: /en). */
export function GET() {
  return Response.json(webManifest("en", THEME_TOKENS.light), { headers: { "Content-Type": "application/manifest+json" } });
}
