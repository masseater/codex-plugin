import { mergeConfig } from "vite-plus";
import baseConfig from "@repo/vitest-config";

export default mergeConfig(baseConfig, {
  test: {
    include: ["**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/*.bun.test.ts"],
    coverage: {
      include: ["hooks/**/*.ts"],
      exclude: ["**/*.test.ts"],
    },
  },
});
