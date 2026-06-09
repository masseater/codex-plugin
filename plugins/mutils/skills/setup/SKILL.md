---
name: mutils:setup
description: 'This skill should be used when the user asks to "set up mutils", "mutilsをセットアップ", "install mutils settings", "mutils setup", or wants recommended mutils references and dependencies applied.'
---

# mutilsプラグインのセットアップ

mutilsプラグインの推奨設定をユーザー環境に適用します。

## 実行手順

### 参照の追加

同名のファイルに参照行を追加してください:

| 選択      | 追加先        | 追加する参照                             |
| --------- | ------------- | ---------------------------------------- |
| AGENTS.md | `~/AGENTS.md` | `@${CLAUDE_PLUGIN_DIR}/assets/AGENTS.md` |

**注意**:

- `${CLAUDE_PLUGIN_DIR}` は plugin-level assets を参照するために使う
- IF: 追加先ファイルが存在しない; THEN MUST: 新規作成する
- IF: 既に同じ参照が存在する; THEN MUST: 追加をスキップする

### 追加作業

- Bun がインストールされているか確認する。
- 依存パッケージをインストールする:
  - `../..` から `bun.lock` が見つかるディレクトリまで上っていき、そこで `bun install` を実行する。
  - これにより workspace 全体（mutils を含む全プラグイン）の依存関係が一括でインストールされる。
  - SessionStart hook の `check-install` がインストール不足を警告した場合も同じ手順で復旧する。
- mutils が生成する `*.mutils_knowledge.md` ファイルが global の gitignore に入っているか確認する。
  - MUST: `git config --global core.excludesfile` で実際の global ignore ファイルを特定する（`~/.gitignore` が必ず global ignore になるとは限らないため）
  - IF: global gitignore に入っていない; THEN MUST: ユーザーの許可を得た上で追記する
- 環境変数 `ENABLE_TOOL_SEARCH=true` が設定されてツール検索ツール機能が有効になっていることを確認する。

### 完了報告

セットアップが完了したら、以下を報告してください:

- 追加したファイルのパス
- 追加した参照の内容

## セットアップされる設定ファイル

- AGENTS.md: AI エージェント向けの汎用コンテキストファイル
- CLAUDE.md: Claude Code 専用のコンテキストファイル
