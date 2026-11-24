import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // public/ no es código fuente del proyecto: build WebGL que genera Unity (no se versiona)
    // y bundles minificados de terceros (p. ej. workers/face-api.min.js).
    "public/webgl/**",
    "public/**/*.min.js",
  ]),
  {
    rules: {
      "react-hooks/exhaustive-deps": "error",
      "react-hooks/rules-of-hooks": "error",
    }
  }
]);

export default eslintConfig;
