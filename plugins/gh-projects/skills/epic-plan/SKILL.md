---
name: epic-plan
description: EPIC の起票から、全体リリース Story と機能別 検証 Story への分解、sub-issue 化、Project への追加、blocked-by の登録までを、各段で承認を取りながら行う。
disable-model-invocation: true
---

# EPIC Plan

方法論は `epic-story-task` に従う。CLI は `../../scripts/gh-project.ts`（以下 `gh-project.ts`）で、`project` スコープが必要（`gh auth refresh -s project`）。コマンドが失敗したら `../cli/SKILL.md` の「落とし穴」を読む。Issue の body は `../../assets/issue-body-templates.md` のテンプレートで書く。Issue のタイトルと本文は英語で書き、ユーザーとの対話は日本語で行う（github-workflow の `create-issue` と同じ方針）。

起票・リンク・依存登録は GitHub 上に残る操作なので、各段の下書きを `AskUserQuestion` で承認してから実行する。

## 開始点

依頼に合わせて途中の段から始める。

- 「EPIC を作って」: 1 から
- 「EPIC #n を分解して」: 2 から
- 「依存関係を整理して」「blocked-by を設定して」: 4 から

不明な入力は最初にまとめて聞く。選択肢で聞ける項目は 1 回の `AskUserQuestion` にまとめる（1 回に最大 4 問）。その項目は、対象リポジトリ `<owner>/<repo>`、Project の owner と番号、Issue Types を使うか `type:*` ラベルで代用するかである。自由記述になる EPIC のタイトルと対象機能の一覧は本文で尋ねる。リポジトリの既定は `gh repo view --json nameWithOwner -q .nameWithOwner` で出す。Project の候補は `gh-project.ts project:list <owner>` で出す。Issue Types を使う場合、使える型の名前は `gh api orgs/<owner>/issue-types --jq '.[].name'` で出す（Issue Types は organization の機能）。

`gh issue create` には Issue Type を指定するフラグがない。Issue Types を使う場合は REST API で起票し、`type` に型の名前を渡す。push 権限がないと `type` は黙って無視されるので、起票後に `gh api repos/<owner>/<repo>/issues/<n> --jq .type.name` で付いたことを確かめる。

```bash
# type:* ラベルで代用する場合
gh issue create -R <owner>/<repo> --title "<title>" --body-file <tmpfile> --label <label>
# Issue Types を使う場合
gh api repos/<owner>/<repo>/issues -f title="<title>" -F body=@<tmpfile> -f type=<type> --jq .html_url
```

以下の「起票する」はこのどちらかを指す。ラベルは EPIC が `type:epic`、Story が `type:story`。

## 1. EPIC を起票する

タイトルは成果の視点で書く（`Improve login experience` はよく、`Implement login refactor` は避ける）。下書きの承認後、本文を一時ファイルに書いて EPIC として起票し、Project に追加する。

```bash
gh-project.ts item:add <owner> <project#> <issue-url>
```

## 2. Story を下書きする

`gh issue view <epic#> -R <owner>/<repo> --json title,body` で目的を読む。`gh-project.ts sub-issue:list <owner>/<repo> <epic#>` で既存の子を確認し、重複を避ける。全体リリース Story を 1 つと、対象機能ごとの検証 Story を下書きする。下書きは番号付きの一覧で示し、「1, 3, 4 だけ採用」のように選べる形で承認を取る。

## 3. Story を起票してつなぐ

承認された Story ごとに、番号順を保つため 1 件ずつ順に、Story として起票してから次を行う。子を作った後の sub-issue 化は忘れやすいので、起票と同じ繰り返しの中で行う。

```bash
gh-project.ts sub-issue:add <owner>/<repo> <epic#> <child#>
gh-project.ts item:add <owner> <project#> <child-url>
```

続けて、各検証 Story を全体リリース Story に blocked-by でつなぐ。

```bash
gh-project.ts block:add <owner>/<repo> <検証Story#> <全体リリースStory#>
```

`block:add` の引数は、ブロックされる側が先、ブロックする側が後。

## 4. 追加の依存を整理する

検証 Story → 全体リリース Story 以外の依存（別 Story の成果物を前提とする Task、別 EPIC や別リポジトリの Issue への依存）を扱う。

```pseudocode
graph = {}
for issue in スコープ内の Story / Task（sub-issue:list を Story ごとに再帰）:
  graph[issue] = deps:show の blocked-by
候補 = 構造上必要だが未登録の依存ペア（理由付き）
AskUserQuestion で候補を示す（承認 / 一部採用 / 向きの入れ替え / やり直し）
approved = 承認されたペア
if graph + approved に循環がある:
  登録せず、循環している Issue の列を報告して終了
for pair in approved:
  gh-project.ts block:add <owner>/<repo> <pair.blocked> <pair.blocking>
  失敗（既存・自己参照など）はスキップリストに入れて続ける
```

依存は body のテキストから推定しない。既存の依存は尊重し、`block:remove` は明示的に頼まれたときだけ使う。1 回で巨大なグラフを作らず、EPIC 1 つずつ処理する。

## 5. 確認して報告する

```bash
gh-project.ts deps:show <owner>/<repo> <epic#>
```

sub-issue の件数、検証 Story が全体リリース Story に blocked-by されていること、すべて Project に入っていることを確認する。作成した Issue の URL、登録した依存ペア、スキップしたペアと理由を報告する。
