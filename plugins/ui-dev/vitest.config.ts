import { mergeConfig } from "vite-plus";
import baseConfig from "@repo/vitest-config";

export default mergeConfig(baseConfig, {
  test: {
    // Plugin test files are in various locations, not just src/
    include: ["**/*.test.ts"],
    exclude: ["**/node_modules/**"],
    coverage: {
      // Figma REST API 呼び出しスクリプト群（skills/figma-data 配下の各コマンド、
      // scripts/figma-scaffold.ts）と hooks/entry の一部は外部 API / Bun 専用 API 依存の
      // オーケストレーション層で、テストは純粋関数の抽出ロジックのみを検証している。
      // グローバル 80% 閾値の対象を「実際に import されテストされる」モジュールに絞る。
      include: [
        "lib/config.ts",
        "skills/figma-data/scripts/_lib.ts",
        "skills/figma-data/scripts/_json.ts",
      ],
      exclude: ["**/*.test.ts"],
    },
  },
});
