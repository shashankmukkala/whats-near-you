import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored maplibre-gl worker scripts (copied verbatim by
    // scripts/copy-maplibre-worker.mjs), not app source.
    "public/maplibre-gl-worker.mjs",
    "public/maplibre-gl-shared.mjs",
    // Deno Edge Functions — separate runtime (Deno globals, remote URL
    // imports) from the Next.js/Node app this config targets.
    "supabase/functions/**",
  ]),
]);

export default eslintConfig;
