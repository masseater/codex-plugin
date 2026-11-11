---
name: workspace-id
description: エージェントの作業ディレクトリ `.agents/workspaces/<workspace-id>/` の命名規約（`yyyymmdd-HHmm-<feature>`）を定義する。ファイル命名と、workspace-id を生成するスクリプトも定義する。エージェントの作業ディレクトリ（`.agents/workspaces/`）を新しく作るとき、「作業ディレクトリを作って」と頼まれたときに使う。
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/generate.ts *)
---

# workspace-id

## 生成

```bash
${CLAUDE_SKILL_DIR}/generate.ts <feature-name> --session-id ${CLAUDE_SESSION_ID}
```

- 出力が workspace-id（例: `20260302-1430-doc-review`）。日時はローカル時刻
- `<feature-name>` は kebab-case（`/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/`）。満たさない名前はスクリプトがエラーにする
- リポジトリに `.agents/` があれば、workspace-id をセッション ID と一緒に mutils DB へ保存する。Auto Compact や resume のあと、この plugin の SessionStart hook は同じセッションの workspace-id を伝える
- 他の skill から生成する場合も、可能なら `--session-id` を付ける。付けないと復元の対象にならない

## ディレクトリとファイル

```text
.agents/workspaces/<workspace-id>/
  <nnnnnn>-<subagent-name>-<content>.md
```

- `<nnnnnn>`: 6 桁ゼロ埋めの連番。ファイルを作るたびに 1 増やす
- `<subagent-name>`: 書いたエージェント名（kebab-case。メイン会話なら `main`）
- `<content>`: 内容の種類（`report`、`review`、`plan` など）
- 例: `000001-documentation-engineer-report.md`
