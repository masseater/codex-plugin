import { mergeConfig } from "vitest/config";
import baseConfig from "@repo/vitest-config";

export default mergeConfig(baseConfig, {
  test: {
    include: ["**/*.test.ts"],
    exclude: ["**/node_modules/**"],
    coverage: {
      include: ["hooks/**/*.ts"],
      exclude: ["**/*.test.ts"],
    },
  },
});
