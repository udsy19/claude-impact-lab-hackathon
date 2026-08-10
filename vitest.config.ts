import { defineConfig } from "vitest/config";

/**
 * Standalone test config — deliberately does NOT extend vite.config.ts, so the
 * React and Tailwind v4 plugins never load during a test run. Every module
 * under test is pure TypeScript, so the node environment is enough.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
