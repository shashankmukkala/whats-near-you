import { setWorkerUrl } from "maplibre-gl";

// Turbopack/webpack rewrite maplibre-gl's own `import.meta.url`, so its
// built-in worker auto-discovery resolves to "" and the map never loads
// (every tile/glyph request hangs forever, no error surfaced). Point it at
// the copy of the worker script served from /public instead — kept in sync
// by scripts/copy-maplibre-worker.mjs (runs on `npm install`).
setWorkerUrl("/maplibre-gl-worker.mjs");
