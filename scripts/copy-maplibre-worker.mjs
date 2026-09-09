// Turbopack/webpack rewrite maplibre-gl's bundled `import.meta.url` to
// something that isn't an http(s) URL, so its own worker auto-discovery
// (defaultWorkerUrl in web_worker.ts) returns "" and every tile/glyph
// request silently hangs forever (Map never fires "load"). We serve the
// worker script as a static asset instead and point maplibre at it via
// setWorkerUrl() in lib/mapWorker.ts.
import { copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptsDir, "..");

// maplibre-gl-worker.mjs imports "./maplibre-gl-shared.mjs" as a relative
// path, so both files must be copied and kept side by side.
const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

for (const file of files) {
  const src = path.join(projectRoot, "node_modules/maplibre-gl/dist", file);
  const dest = path.join(projectRoot, "public", file);

  if (!existsSync(src)) {
    console.warn(`[copy-maplibre-worker] source not found, skipping: ${src}`);
    continue;
  }

  copyFileSync(src, dest);
  console.log(`[copy-maplibre-worker] copied ${file} to public/`);
}
