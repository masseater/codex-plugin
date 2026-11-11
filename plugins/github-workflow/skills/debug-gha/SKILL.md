---
name: debug-gha
description: GitHub Actions の失敗した run のフルログを ZIP で取得して原因を特定し、修正する。「CI が落ちた」「GitHub Actions をデバッグして」「ワークフローが失敗した」「GHA のログを見て」と頼まれたときに使う。
---

# Debug GitHub Actions

## run の特定

```pseudocode
if ユーザーが run ID を指定: その run
elif PR 番号を指定:
  checks = gh pr checks <pr> --json bucket,name,link
  failed = bucket == "fail" かつ link が空でないもの   # link が空なのは外部 check（CodeRabbit など）
  if failed が空: 「失敗した Actions の check はない」と報告して終了
  run_id = failed[0].link の /actions/runs/(\d+)/ 部分
else:
  gh run list --branch "$(git branch --show-current)" --status failure --limit 5 --json databaseId,name,createdAt
  空ならブランチ指定なしで同じコマンド。最新の 1 件を使う
```

失敗した job と step は次で確認する。

```bash
gh run view <run_id> --json jobs --jq '.jobs[] | {name, conclusion, steps: [.steps[] | {name, conclusion}]}'
```

## ログの取得

`gh run view --log` / `--log-failed` は使わない。job が 25 件を超えると取得に失敗し、一部の step が `UNKNOWN STEP` になるため。ZIP API で全ログを取る。

```bash
LOG_DIR=".local-agents/tmp/gha-logs/<run_id>"
mkdir -p "$LOG_DIR"
gh api "repos/{owner}/{repo}/actions/runs/<run_id>/logs" > "$LOG_DIR/logs.zip"
unzip -o "$LOG_DIR/logs.zip" -d "$LOG_DIR/extracted/"
ls -R "$LOG_DIR/extracted/"
```

`{owner}/{repo}` は `gh` が現在のリポジトリから埋める。展開結果の構造は workflow によって異なるので `ls` で確認してから読む。典型的には次の形になる。

- `<N>_<job 名>.txt`: job のフルログ（N は 0 始まり）
- `<job 名>/<N>_<step 名>.txt`: step ごとのログ（N は 1 始まり。ないこともある）
- `<job 名>/system.txt`: runner のシステムログ

## 原因の特定

失敗した job のログで `##[error]` の行を grep で探し、その行を含む step の開始（直前の `##[group]`）からエラー行までを Read の offset / limit で読む。本当の原因（失敗したコマンドの出力やスタックトレース）は `##[error]` の行より前にあるので、エラー行の前後数行だけで判断しない。その範囲に原因が無いときだけ、前の step へ範囲を広げる。`##[error]` がエラー行、`##[group]` / `##[endgroup]` が step 内の折りたたみ区切り。

## 修正

- コードのバグ: 修正してローカルで該当テストを通す
- 依存関係: `package.json` と lockfile を更新する
- workflow の設定: `.github/workflows/*.yml` を直す
- 一時的なネットワーク障害など: コードは直さず、`gh run rerun <run_id> --failed` で再実行できることを報告する

commit・push・`gh run rerun` は、ユーザーが頼んだとき、または `pr-watch` の手順の中で使われているときだけ行う。この skill は Claude が自分から使うことがあり、外部に残る操作のタイミングはユーザーが決めるため。

- 原因が特定できない: ログの該当箇所とファイルパスを示してユーザーに判断を求める

報告には、失敗した job と step、エラー行、原因、行った修正（または必要な対応）を含める。
