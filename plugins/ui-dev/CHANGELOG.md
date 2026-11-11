# Changelog

## [Unreleased]

### Changed

- figma-screenshot スキルを figma-data に統合し、`export-screenshot.ts` を `skills/figma-data/scripts/` へ移動
- dev-command スキルを削除し、デザインフィードバックと QA チェックリストの形式を figma-implement の `references/handoff.md` へ移動
- redirect-figma-screenshot hook を `permissionDecision: "deny"` 形式に変更し、figma-implement の frontmatter からの重複登録を削除
- notify-phase-status hook の再開案内を `systemMessage` で表示し、実装中のフローをすべて案内するよう変更
- `cc-hooks-ts` を `2.1.149` から `2.1.196` に更新

### Removed

- 未使用の `dump-raw-response.ts` を削除
- figma-screenshot スキルから Desktop MCP フォールバック機能を削除。REST API (`FIGMA_ACCESS_TOKEN`) のみをサポートするよう簡素化
