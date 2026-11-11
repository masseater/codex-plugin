# context プラグイン開発ガイド

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
プロジェクトのコンテキストファイル（AGENTS.md / CLAUDE.md / .claude/rules/ / README）の整理と事実検証を支援する。

## 設計

- `context-refactor` と `verify-docs` は呼び出し制御のフィールドを持たず、ユーザーと Claude の両方が呼び出せる。どちらもユーザーが自然文で頼む作業である。`context-refactor` は書き込み前に計画を 1 回提示して承認を取る。`verify-docs` は修正を頼まれたとき（`--fix` か文面）だけファイルを書き換え、確認だけの依頼では修正案の提示で止まる
- hook `redirect-claude-md-edit` は、AGENTS.md への symlink、`@AGENTS.md` を import する CLAUDE.md、`~/.claude/CLAUDE.md` を許可する。それ以外の CLAUDE.md への Write / Edit は deny して AGENTS.md へ誘導する。判定は編集適用後の内容で行う

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

- **skill** `context-refactor`: プロジェクトのコンテキストファイル（AGENTS.md / CLAUDE.md / .claude/rules / README.md）を読み、各記述の置き場所を振り分けて再配置する。置き場所の候補は AGENTS.md 階層・path-scoped rule・skill・hook・README である。「AGENTS.md を整理して」「CLAUDE.md を分解して」「CLAUDE.md を AGENTS.md に移行して」と頼まれたときに使う。引数でファイルを指定するとそのファイルだけを対象にする。
- **skill** `verify-docs`: Markdown ドキュメントに書かれたパス・コマンド・件数・版数・相互参照などの事実主張をコードベースと Web で検証し、全主張の判定と修正案を報告する。対象は指定がなければ AGENTS.md / CLAUDE.md / rules で、指定すれば README / docs も含む。修正の適用は頼まれたときだけ行う。「この AGENTS.md の記述は正しいか確認して」「ドキュメントが古くなっていないか確認して」「README をセクションごとに見直して」と頼まれたときに使う。指示文としての書き方の質は対象外（それは `/doctor prompt-audit` の役割）。
- **hook** `install-deps`: SessionStart
- **hook** `redirect-claude-md-edit`: PreToolUse (`Write|Edit`)

<!-- END:component-list -->
