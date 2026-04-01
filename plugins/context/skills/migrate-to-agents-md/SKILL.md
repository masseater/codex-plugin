---
name: context:migrate-to-agents-md
description: CLAUDE.mdをAGENTS.mdにマイグレーション
---

プロジェクトのCLAUDE.mdをAGENTS.mdにマイグレーションしてください。

## 手順

1. CLAUDE.mdの内容を確認
2. CLAUDE.mdをAGENTS.mdにリネーム
3. AGENTS.mdのヘッダーを更新（「# CLAUDE.md」→「# AGENTS.md」、説明文も適切に変更）
4. 新しいCLAUDE.mdを作成し、`@AGENTS.md` のみを記載

## 注意事項

- AGENTS.mdは汎用的なプロジェクト注意事項として使用される
- CLAUDE.mdはClaude Code特有の参照ファイルとして残す
- 既存の内容は保持し、ヘッダーのみ変更する
