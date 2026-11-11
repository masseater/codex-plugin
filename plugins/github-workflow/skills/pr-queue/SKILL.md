---
name: pr-queue
description: 複数の PR の依存関係を検出して base をチェーンし、1 つずつ merge 完了まで処理する。
disable-model-invocation: true
---

# PR Queue

$ARGUMENTS

引数の PR 番号・URL・ブランチ名の一覧を対象にする。個々の PR の処理は `pr-watch` の対応モードと同じで、それをサブエージェントで 1 PR ずつ逐次実行する。このセッションは依存解決・base 付け替え・状態記録・ユーザーとの対話を担当し、PR の中身の修正はサブエージェントに任せる。複数 PR の文脈を 1 つのセッションに溜めないため。

## 手順

```pseudocode
entries = [gh pr view <ref> --json number,url,headRefName,baseRefName,state for ref in args]

# 1. 依存の検出
for e in entries:
  e.files = gh pr diff <e.number> --name-only
  e.summary, e.depends_on = diff を読み、他の PR が追加する export・ファイルを使っているか判断する
for (a, b) in 同じファイルを変更している組で、まだ依存がないもの:
  番号の大きい方を小さい方に依存させる
循環があればユーザーに解消方法を聞く

# 2. 順序の決定
chain       = 依存を持つか依存される PR をトポロジカルソート（同順位は番号の昇順）
independent = それ以外を番号の昇順
order       = chain + independent

# 3. 確認
AskUserQuestion: chain（各 PR の要約と依存理由）と independent を分けて示し、
                 この順で処理 / 順序を変更 / 中止 を選ばせる

# 4. base のチェーン
for i in 1..len(chain)-1:
  gh pr edit <chain[i]> --base <chain[i-1].headRefName>
状態ファイルを作る

# 5. 逐次処理
for e in order:
  if e の依存先に failed / blocked がある:
    e.status = blocked; 状態ファイル更新; ユーザーに続行方法を聞く; continue
  result = サブエージェントで e を処理（下記プロンプト）し、完了を待つ
  if result.merged:
    e.status = merged
    if e が chain 内で次の PR がある:
      gh pr edit <次の PR> --base <e.baseRefName の元の値>
  else:
    e.status = result.status（failed / blocked）; 依存している PR を blocked にする
    result.needs_user_decision があればそれを示し、ユーザーに続行方法を聞く
  状態ファイル更新
最後に merged / failed / blocked の件数と理由、状態ファイルのパスを報告する
```

1 の依存判断はこのセッションで直接行う。PR が 8 件以上あり diff を読む量が多い場合だけ、PR ごとの判断をサブエージェントへ分けてよい。

## 守ること

- チェーンに入れるのは依存のある PR だけにする。独立した PR の base を他 PR のブランチにすると、その PR の diff に無関係な変更が混ざるため、independent は base を変えない
- squash merge するとチェーン前段のブランチは削除されるので、merge のたびに次の PR の base を元の base（通常 main）に付け替える
- ダイヤモンド依存（A→B、A→C、B+C→D）は線形化される。B と C の一方の PR ページに他方の変更が表示されることを、3 の確認時に明示する
- base の付け替えは他人の PR にも影響しうるので、3 の承認を得てから行う

## サブエージェントへのプロンプト

```text
次の PR を merge 完了まで処理してください。手順は ../pr-watch/SKILL.md の対応モードに従います。
そのファイル内の skill ディレクトリ変数は展開されていないので、スクリプトは ../pr-watch/scripts/<名前>.ts のパスで実行してください。
PR: <url>（#<number>）、ブランチ: <headRefName>、base: <現在の base>
pr-watch のスクリプトは現在のブランチの PR しか扱えないので、最初に git status --porcelain で未コミットの変更がないことを確かめてから gh pr checkout <number> で切り替えてください。未コミットの変更があれば何もせず status: blocked で返してください。
サブエージェントでは ScheduleWakeup が使えないので、待ちは Monitor で行ってください。
AskUserQuestion も使えません。ユーザーの判断が要る操作（修正不要と判断したレビュー指摘の扱い、他ブランチの run の cancel など）は実行せず、status: blocked と判断材料を返してください。
完了したら次の形式で報告してください。
- status: merged / failed / blocked
- merge_commit: <merged のとき>
- actions_taken: <行った操作の要約>
- failure_reason: <failed / blocked のとき>
- needs_user_decision: <blocked のとき、ユーザーに決めてほしいことと判断材料>
```

## 状態ファイル

`.local-agents/pr-queue/<YYYYMMDD-HHMMSS>.md` に [assets/state-template.md](assets/state-template.md) の形式で記録し、各 PR の状態が変わるたびに更新する。セッションが途切れたら、このファイルを読んで未処理の PR から再開する。
