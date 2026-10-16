// maplibre-gl 6 loads its web worker from a separate module file. Serve it
// from public/ (git-ignored) so the bundled app can point to a stable URL.
import { copyFileSync, mkdirSync } from "node:fs";

const target = new URL("../public/vendor/maplibre/", import.meta.url);
mkdirSync(target, { recursive: true });
copyFileSync(
  new URL("../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url),
  new URL("maplibre-gl-worker.mjs", target),
);
