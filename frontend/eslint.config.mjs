import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // The reviewed security regression runner deliberately uses CommonJS to
  // exercise the original CommonJS braces API; keep normal application rules.
  {
    files: ["scripts/security/*.cjs", "scripts/quality/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    // Downloaded upstream references and browser screenshots/logs are not app source.
    "quality-audit/.evidence/**",
    "blob-report/**",
    "next-env.d.ts",
    // Third-party MIT package source. Validated independently by
    // scripts/security/verify-braces.cjs, not with app-specific ESM rules.
    "vendor/**",
  ]),
]);
