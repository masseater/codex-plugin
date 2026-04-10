import base from "@repo/vitest-config";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  base,
  defineConfig({
    test: {
      coverage: {
        include: ["src/index.ts"],
        exclude: ["src/**/*.test.ts"],
      },
    },
  }),
);
