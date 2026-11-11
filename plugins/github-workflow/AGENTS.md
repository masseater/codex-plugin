# github-workflow Plugin Development Guide

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。

## Overview

GitHub 上の作業フロー（PR・CI・Issue・コミット）を扱う。

- PR: `pr-watch` が単一 PR を merge 完了まで見届け、`pr-queue` が複数 PR を依存順に `pr-watch` で処理する。base 取り込み後の検証は `verify-merge`、CI 失敗の調査は `debug-gha`
- Issue: GitHub の issue をローカル SQLite（FTS5 trigram）にキャッシュし、`create-issue` が重複を確認して起票、`issue-review` が解決済みかを判定して更新する
- hooks: 3 本とも hooks.json で `"async": true` にしていて、結果は次のターンで Claude に渡る（ユーザーには表示されない）。`on-push` は push 直後に PR の conflict を伝え、conflict がなければ head SHA の workflow run を最大 10 分監視して結果を返す。`check-branch-status` は Stop 時に upstream との先行・遅れと PR base との conflict を、状態が変わったときだけ返す。PR がある branch では Stop のたびに `gh pr view` と base の `git fetch` を行うが、作業ツリーは変更しない（pull はしない）。`suggest-actions-update` は workflow の action に新しい major があれば参考情報として返す。cc-hooks-ts の `context.defer` は公式仕様に無い 2 行出力なので使わない

## Development Commands

```bash
cd plugins/github-workflow

vp run check         # fmt・lint・型検査（vp check）
vp run typecheck     # type check
vp run test          # vp test + bun test（issue-db の SQLite テスト）
```

## 設計判断

- skill から実行するスクリプトは skill ディレクトリの `scripts/` に置き `${CLAUDE_SKILL_DIR}` で参照する。issue-db のように複数 skill が使うものは plugin 直下の `scripts/` と `lib/` に置く
- GitHub API のトークンは `lib/octokit.ts` の `resolveGithubToken` で解決する（`GITHUB_TOKEN`、なければ `gh auth token`）。ローカル CLI では `GITHUB_TOKEN` が通常ないため
- 呼び出し制御: `pr-watch`・`pr-queue`・`create-issue`・`issue-review` は push・merge・base の付け替え・Issue への書き込みをする。`organize-commits` は commit の作成そのものが目的である（公式が `/commit` を例に挙げている型）。これらは実行タイミングをユーザーが決めるので `disable-model-invocation: true` にしている。`pr-queue` のサブエージェントは Skill ツールで `pr-watch` を呼べないので、`pr-watch` の SKILL.md を直接読ませる。読み取りとローカルの検出だけの `verify-merge`・`debug-gha` は model invocation を許可する

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

- **skill** `create-issue`: 会話や調査で見つかった 1 件以上の課題を、既存 Issue との重複を確認したうえで GitHub Issue として起票するか、既存 Issue にコメントする。承認を得てから実行する。
- **skill** `debug-gha`: GitHub Actions の失敗した run のフルログを ZIP で取得して原因を特定し、修正する。「CI が落ちた」「GitHub Actions をデバッグして」「ワークフローが失敗した」「GHA のログを見て」と頼まれたときに使う。
- **skill** `issue-review`: 1 件、または条件で選んだ複数の GitHub Issue が現在のコードで解決済みかを証拠付きで判定し、承認を得てからコメント・ラベル・close を更新する。
- **skill** `organize-commits`: 作業ツリーの変更を関心ごとに分けたコミット計画を提示し、承認後にその単位でコミットする。
- **skill** `pr-queue`: 複数の PR の依存関係を検出して base をチェーンし、1 つずつ merge 完了まで処理する。
- **skill** `pr-watch`: 単一の PR を conflict・behind・CI 失敗・未解決レビューの順に判定し、ローカルで直して push しながら merge 完了まで見届ける。状態確認だけの 1 回モードもある。
- **skill** `verify-merge`: base の取り込みや conflict 解消の結果に、意図しない変更の混入・ブランチの変更の消失・コンフリクトマーカーの残りがないかを検出する。merge や conflict 解消の後、push の前に使う。「マージ結果を確認して」「コンフリクト解消が正しいか見て」と頼まれたときにも使う。
- **hook** `check-branch-status`: Stop
- **hook** `install-deps`: SessionStart
- **hook** `on-push`: PostToolUse (`Bash`)
- **hook** `suggest-actions-update`: PostToolUse (`Write|Edit`)

<!-- END:component-list -->
