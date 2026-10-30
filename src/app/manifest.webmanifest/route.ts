import { webManifest } from "@/lib/pwa/manifest";
import { THEME_TOKENS } from "@/lib/pwa/theme";

/** The Turkish web app manifest (start: /); en/manifest.webmanifest is the English one. */
export function GET() {
  return Response.json(webManifest("tr", THEME_TOKENS.light), { headers: { "Content-Type": "application/manifest+json" } });
}
