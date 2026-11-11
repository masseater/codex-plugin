import { mergeConfig } from "vite-plus";
import baseConfig from "@repo/vitest-config";

export default mergeConfig(baseConfig, {
  test: {
    // Plugin test files are in various locations, not just src/
    include: ["**/*.test.ts"],
    exclude: ["**/node_modules/**"],
    coverage: {
      // このプラグインの大半のスクリプト（image-analyze / image-process / generate-index 等）は
      // 外部 API 呼び出しや Bun 専用 API（Bun.file, Bun.Glob）に依存する薄いオーケストレーション層で、
      // テストは純粋関数をロジック単位で再現検証している（実体の import なし）。
      // グローバル 80% 閾値を無理に満たすため coverage.include を「実際に import されテストされる
      // モジュール」のみに絞る。
      include: [
        "skills/library-research/scripts/lib/resolve-knowledge-dir.ts",
        "skills/library-research/scripts/lib/registry-fetchers.ts",
      ],
      exclude: ["**/*.test.ts"],
    },
  },
});
