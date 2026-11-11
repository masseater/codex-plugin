# devkit

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
開発ツールキット — 技術スタック定義・プロジェクトセットアップ・品質自動化。

## 設計

- skill はすべて呼び出し制御のフィールドを持たない
  - `standards`: 技術選定や設定の判断中に Claude が参照するリファレンス
  - `standards-audit`: 「規約チェックして」という自然文の依頼で使う。読み取り専用で副作用がない。旧 `cli-compliance` は `--reference cli` で代替する
  - `init-project`: 「プロジェクトを立ち上げたい」という自然文の依頼で使う。新規作成ではまず名前を聞き、既存ファイルの上書き前に確認を取る
- agent `standards-auditor` は `standards-audit` から「スコープのグループ × 各スコープの全 reference」単位で呼ばれる（最大 8 体）。全指摘を severity と confidence 付きで返す
- agent `standards-reviewer` は、差分をこのユーザー固有のコーディング規約（旧 code-review plugin の reviewer から抽出）で見る。一般的なバグ・可読性は組み込みの `/code-review` / `/simplify` に任せる。自動委譲を促す文言（"Use proactively" など）は description に書かない
- 機械的に判定できる規約は `skills/standards-audit/scripts/checks/` にチェックとして追加し、サブエージェントに回す範囲を減らす

## hook

- `block-deny-command`（PreToolUse Bash）: `DEVKIT_ENFORCE_TOOLS` 設定時だけ、`DENY_RULES` の npx / npm / tsc を deny して代替コマンドを示す
- `standards-audit`（SessionStart / Stop）: `DEVKIT_AUDIT_ON_STOP` 設定時だけ動く。SessionStart で違反の基準値を `$XDG_STATE_HOME/claude-code-plugin/devkit/standards-audit/<session_id>.json` に記録する。Stop では基準値と通知済みのどちらにも無い違反だけを additionalContext で 1 回通知する。SessionStart は `session-start-wrapper.sh` 経由で install-deps のあとに実行する

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

- **skill** `init-project`: devkit の規約に沿って新しい TypeScript Web プロジェクトを作成するか、既存プロジェクトに不足しているツールと設定を補う。「新しいプロジェクトを立ち上げたい」「このプロジェクトに devkit の構成を入れて」と頼まれたときに使う。
- **skill** `standards`: devkit の TypeScript 技術スタックとコーディング規約（ツール選定、lint/format/test/env の設定方針、CLI・Web・backend の構成、意図的逸脱の記録）。TypeScript プロジェクトでツールやライブラリを選ぶとき、lint・テスト・環境変数・CI の設定を決めるとき、devkit の規約に照らして判断するときに参照する。
- **skill** `standards-audit`: プロジェクト（monorepo なら各 workspace）を devkit の規約と照合し、違反と未導入の推奨事項を一覧で報告する。読み取り専用。「規約チェックして」「devkit の規約に沿っているか監査して」「この CLI ツールが規約どおりか見て」と頼まれたときに使う。
- **agent** `standards-auditor`: 1 つ以上のプロジェクトスコープを、スコープごとに割り当てられた devkit standards の reference と照合する。全指摘は severity と confidence 付きの JSON 配列で返す。standards-audit skill から使う。
- **agent** `standards-reviewer`: 変更差分（または指定ファイル）をレビューし、全指摘を severity と confidence 付きで返す。基準はこのユーザーのコーディング規約（型の扱い、実装スタイル、fallback の乱用、不要コード）と devkit の Philosophy である。一般的なバグ探しや可読性の指摘は組み込みの /code-review と /simplify に任せ、ここでは固有規約だけを見る。ユーザーがこのユーザー固有の規約や devkit の Philosophy に照らしたレビューを頼んだときに使う。
- **hook** `block-deny-command`: PreToolUse (`Bash`)
- **hook** `install-deps`: SessionStart
- **hook** `standards-audit`: Stop, SessionStart

<!-- END:component-list -->
