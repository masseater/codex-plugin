# workspace-id プラグイン開発ガイド

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
エージェント作業ディレクトリの命名規約（workspace-id）を定義し、Auto Compact / resume 時に同じセッションの workspace-id を復元するプラグイン。

## 設計

- skill `workspace-id` は呼び出し制御のフィールドを持たない。作業ディレクトリを作るときに Claude が参照する規約で、mutils `faithful-migration` と diagram-render `draw-diagram` から参照されている
- `generate.ts` は workspace-id を mutils DB（`.agents/mutils/mutils.db` の `workspace_mappings`）に `session_id` 付きで保存する。スキーマは `hooks/lib/workspace-mappings-schema.ts` に一本化し、`session_id` 列の無い旧 DB は開くときに列を追加する
- hook `workspace-id-persist` は SessionStart の source が compact / resume のときだけ動く。そのとき同じ `session_id` の最新レコードを additionalContext で伝える。他セッションのレコードや `session_id` の無いレコードは復元しない（並行セッションの取り違え防止）

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

- **skill** `workspace-id`: エージェントの作業ディレクトリ `.agents/workspaces/<workspace-id>/` の命名規約（`yyyymmdd-HHmm-<feature>`）を定義する。ファイル命名と、workspace-id を生成するスクリプトも定義する。エージェントの作業ディレクトリ（`.agents/workspaces/`）を新しく作るとき、「作業ディレクトリを作って」と頼まれたときに使う。
- **hook** `install-deps`: SessionStart
- **hook** `workspace-id-persist`: SessionStart

<!-- END:component-list -->
