import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Pure TS/logic modules only (lib/metrics, CSV import/export) — no
    // React components under test yet, so a plain Node environment is
    // enough and keeps test runs fast. If component tests are added later,
    // switch this per-file via a `// @vitest-environment happy-dom` docblock
    // rather than flipping this globally.
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
