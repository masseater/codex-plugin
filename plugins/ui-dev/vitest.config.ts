import { mergeConfig } from "vitest/config";
import baseConfig from "@repo/vitest-config";

export default mergeConfig(baseConfig, {
  test: {
    // Plugin test files are in various locations, not just src/
    include: ["**/*.test.ts"],
    exclude: ["**/node_modules/**"],
    coverage: {
      include: ["hooks/**/*.ts", "skills/**/*.ts", "lib/**/*.ts", "scripts/**/*.ts"],
      exclude: ["**/*.test.ts"],
    },
  },
});
