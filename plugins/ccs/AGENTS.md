# CCS プラグイン

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
CCS (Claude Code Sessions) 環境の自動設定・セッション管理・委譲ワークフローを提供するプラグイン。

## 設計

- skill はどちらも呼び出し制御のフィールドを持たない。ユーザーが「use ccs ...」「引き継いで」と自然文で頼む作業のため
  - `ccs-delegation`: 委譲は外部 CLI の実行とコストを伴うので、ユーザーが委譲を頼んだときだけ使う。description に「typo なら自動で委譲」のような広い trigger を書かない
  - `ccs-handoff`: 引き継ぎ情報の取得は `ccs-handoff.ts` が行い、skill は出力の使い方だけを書く
- hook `ccs-symlink-check`（SessionStart）は `~/.ccs/config.yaml` の shared context アカウントの symlink を検証・修復する。修復したときだけ、ユーザー向けの systemMessage で知らせる（Claude の作業には関係しないため additionalContext にしない）

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

- **skill** `ccs-delegation`: CCS CLI（`ccs <profile> -p "<task>"`）で、範囲が明確な作業を別モデルのプロファイル（glm / kimi など）に委譲する。続きは `ccs <profile>:continue` で頼む。範囲が明確な作業とは typo 修正、テスト追加、単純なリファクタ、ドキュメント更新などである。ユーザーが「use ccs <task>」「use ccs:continue <follow-up>」「ccs に任せて」と頼んだときに使う。
- **skill** `ccs-handoff`: 別の CCS プロファイルのセッションがレート制限・利用上限・コンテキスト溢れで止まったとき、そのセッションの要約・未完了タスク・直近のやり取りを読み込んで作業を引き継ぐ。「CCS のセッションを引き継いで」「レート制限で止まった作業を続けて」と頼まれたときに使う。引数は `<profile> <sessionId>`。
- **hook** `ccs-symlink-check`: SessionStart
- **hook** `install-deps`: SessionStart

<!-- END:component-list -->
