import { mergeConfig } from "vitest/config";
import baseConfig from "@repo/vitest-config";

export default mergeConfig(baseConfig, {
  test: {
    // *.bun.test.ts files use bun:sqlite / bun:test and cannot run under vitest (Node).
    // Run them with `bun test` instead — see package.json test:bun.
    include: ["**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/*.bun.test.ts"],
    coverage: {
      include: ["lib/**/*.ts", "scripts/**/*.ts"],
      exclude: ["**/*.test.ts"],
    },
  },
});
