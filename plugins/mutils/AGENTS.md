# mutils プラグイン開発ガイド

全プラグインの前提となる汎用ユーティリティプラグイン。変更は Auto Version Bump workflow で patch bump される。

## 開発コマンド

```bash
cd plugins/mutils
vp run check         # fmt・lint・型検査（vp check）
vp run check:fix     # 自動修正
vp run typecheck     # 型チェック
vp run test          # テスト（vp test と skill-create スクリプトの bun test）
```

未使用コードの検出（knip）はリポジトリルートで `vp run knip` を実行する。

## Hooks 実装

hook の書き方はリポジトリの `.claude/rules/hook-authoring.md` に従う。mutils の hook は複数セッションから同時に実行されることがあるので、共有ファイルへの書き込みは追記にするか、セッション ID ごとにファイルを分ける（共有ファイルを上書きすると他セッションの記録が消える）。共通設定は `lib/config.ts` に置く。

## 配布物

`assets/AGENTS.md` は `setup` skill がユーザーの `~/AGENTS.md` にコピーする個人ルールで、毎セッション読み込まれる。200 行未満を保ち、書き方は docs/plugin-authoring-guidelines.md に従う。

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

- **skill** `automation-advisor`: リポジトリの設計（hook・skill・rule・CI）と実際の作業履歴（AI セッション・git log・コード重複）を突き合わせる。そのうえで、まだ自動化されていない繰り返しを提案するレポートを .local-agents/ に出力する。
- **skill** `codex-guide`: Claude Code から OpenAI Codex CLI（codex exec / codex review）を呼び出す方法。用途は計画やコードのセカンドオピニオンを得ることと、単発タスクや画像生成を任せることである。Codex でレビューしたいとき、Codex の使い方や設定を聞かれたときに使う。
- **skill** `consecutive-review-loop`: 履歴を含まない固定プロンプトでサブエージェントにレビューさせ、指摘を直しながら N 回連続で合格するまで繰り返す。「3 回連続でレビューが通るまで回して」「サブエージェントで連続レビュー」と頼まれたときに使う。
- **skill** `faithful-migration`: リポジトリ A の機能をリポジトリ B へ、範囲を黙って縮めずに移植・リライト・フォーク後カスタマイズする。全画面と全 API の 1:1 列挙、構成図、縮小語彙の検査、1 PR = 1 outcome、merge 前のローカル検証で進め、outcome ごとに PR を作る。
- **skill** `find-masseater-component`: masseater/codex-plugin の skill・agent・hook を検索・一覧表示する。検索元は各 plugin の AGENTS.md の一覧である。「あのスキル何だっけ」「〜する skill はあるか」「どんなスキルがあるか」と聞かれたときに使う。手動呼び出し専用（disable-model-invocation）の skill は description がコンテキストに載らないので、名前を思い出せないときはこれで探す。
- **skill** `ideal-driven-design`: 手段を含まない理想を先に固定し、複数の設計案がその理想を満たすかを敵対的に検証してから設計を決める。「理想から設計して」「理想駆動で」「手段にとらわれず設計したい」と頼まれたら使う。persona の idealist が理想を明文化するときと、planner が理想から設計案を作り検証するときにも使う。
- **skill** `instruction-writing`: エージェント向けの指示を書く・直すときの書き方。対象は AGENTS.md / CLAUDE.md / SKILL.md / .claude/rules / サブエージェント定義 / hook がモデルに渡す文言などである。要点は条件→行動→理由、強調を控える、肯定形、状態遷移には疑似コード、旧モデル向けの補助を書かないことである。規約やルールの追加、指示文の書き直し、既存の指示文書の見直しを頼まれたときに使う。
- **skill** `interview`: AskUserQuestion でユーザーにインタビューし、曖昧な要望を要件にまとめる、または計画・仕様の不明点を詰めて文書に反映する。「やりたいことがうまく言えない」「要件を整理して」「インタビューして」「計画の曖昧な点を詰めて」「深掘りして」と頼まれたときに使う。
- **skill** `product-review`: プロダクト全体を階層的にスキャンして改善候補を出し、ユーザーが承認した候補を実行して候補ごとに commit する。対象はコード構造、アーキテクチャ、横断的関心事、AI ハーネス、インフラ、ドキュメント、プロダクト設計である。
- **skill** `session-conflict`: 同じリポジトリで並行稼働する他の Claude Code セッションとの競合を、ccsight で相手の状態を確認し宣言ブロックで合意してから解消する手順。merge conflict・予期しない差分・lock 待ち・push reject・未取得のリモートコミットなどに遭遇したときに使う。
- **skill** `setup`: mutils の個人ルール（assets/AGENTS.md）を `~/AGENTS.md` に同期し、`~/.claude/CLAUDE.md` から読み込まれるようにして、依存をインストールする。
- **skill** `skill-create`: Claude Code の skill を scaffold・執筆・検証するワークフロー。ディレクトリと SKILL.md の雛形作成、参照ファイル一覧の注入、frontmatter と本文の検証をスクリプトで行う。「スキル化して」「新しい skill を作って」「この手順を skill にしたい」と頼まれたときに使う。
- **skill** `task-history`: mutils の task-history hook が記録したタスク・TODO の履歴（TodoWrite / TaskCreate / TaskUpdate）を照会する。過去のセッションで何をしたか、何が未完了のまま残っているかを示す。「前回の続きをやりたい」「前のセッションで残ったタスクを見せて」「過去の作業を振り返って」と頼まれたときに使う。
- **hook** `block-cross-worktree-edit`: PreToolUse (`Write|Edit`)
- **hook** `block-husky-bypass`: PreToolUse (`Bash`)
- **hook** `block-unsafe-type-assertion`: PreToolUse (`Write|Edit`)
- **hook** `check-context-version`: SessionStart
- **hook** `check-install`: SessionStart
- **hook** `continue-open-tasks`: Stop
- **hook** `install-deps`: SessionStart
- **hook** `merge-session-start-output`: SessionStart
- **hook** `record-schedule-wakeup`: PostToolUse (`ScheduleWakeup`)
- **hook** `task-history`: PostToolUse (`TodoWrite|TaskCreate|TaskUpdate`)

<!-- END:component-list -->
