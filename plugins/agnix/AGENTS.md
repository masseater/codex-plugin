# agnix

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
AI アシスタント設定ファイルリンター（agnix）統合。

## 設計

- skill `agnix` は呼び出し制御のフィールドを持たない。ユーザーが自然文で「AGENTS.md を lint して」と頼む用途で、lint 自体は読み取り専用、修正は `--fix-safe` を既定にしている
- hook `lint-config-file` は agnix が PATH に無ければ何もしない。`agnix --format json` の出力に error か warning があったときだけ、結果と `--fix-safe` の修正コマンドを additionalContext で返す。agnix は warning だけのとき終了コード 0 を返すので、終了コードでは判定しない

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

- **skill** `agnix`: agnix CLI で Claude Code の設定ファイルをベストプラクティス違反の観点で lint し、修正する。対象は CLAUDE.md / AGENTS.md / SKILL.md / hooks.json / plugin.json / settings.json / .mcp.json / .claude/rules である。「AGENTS.md を lint して」「SKILL.md の設定ミスを検査して」と頼まれたときに使う。
- **hook** `install-deps`: SessionStart
- **hook** `lint-config-file`: PostToolUse (`Write|Edit`)

<!-- END:component-list -->
