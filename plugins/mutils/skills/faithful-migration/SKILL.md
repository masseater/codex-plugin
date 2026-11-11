---
name: faithful-migration
description: リポジトリ A の機能をリポジトリ B へ、範囲を黙って縮めずに移植・リライト・フォーク後カスタマイズする。全画面と全 API の 1:1 列挙、構成図、縮小語彙の検査、1 PR = 1 outcome、merge 前のローカル検証で進め、outcome ごとに PR を作る。
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(ls *), Bash(find *), Bash(rg *), Bash(git status), Bash(git diff *), Bash(git log *), Bash(gh pr create *), Bash(gh pr view *), Bash(gh pr diff *), Bash(gh issue view *), Bash(gh issue list *), Bash(${CLAUDE_SKILL_DIR}/scripts/check-shrink-vocab.ts *), Agent, TodoWrite
---

# faithful-migration

移植作業は、観測上次のような縮小再生産に陥りやすい。各手順はこれを防ぐためにある。

1. 完了判定が機能カテゴリの網羅（骨格・domain・api・web）にすり替わり、個々の UI フローの 1:1 性が完了条件から外れる
2. 個々の UI フローの突合を「mock 除去」「実フロー接続」の言葉で済ませる
3. 設計変更が要る部分を「(編集モード)のみ対応」のような部分対応の宣言で逃げる
4. 突合の範囲を自分で狭めて「忠実な移植を確認した」と宣言する
5. 動作確認を「merge 後にローカルで確認」と先送りする

対象: `$ARGUMENTS`

## 成果物

workspace-id skill で `faithful-migration-<short-tag>` の作業ディレクトリ `.agents/workspaces/<workspace-id>/` を作り、成果物はすべてそこに置く。後から別のセッションが同じ場所で進捗を確かめられるようにするため。

- `000001-main-outcome.md`: 着手前に宣言した outcome
- `000002-main-enumeration.md`: 全画面と全 API の列挙と、移植先との対応
- `000003-main-source-diagram.md` / `.html`: 移植元のシステム構成図
- `000004-main-target-diagram.md` / `.html`: 移植先の規約で組み直した構成図
- `000005-main-pr-bodies/<outcome-slug>.md`: PR 本文のドラフト
- `000006-main-screenshots/<flow-name>/`: merge 前のローカル検証のスクリーンショット

## 手順

1. 完了条件を決める。ユーザーが手元で 1 周通せる具体的なフローを outcome として宣言し、`000001-main-outcome.md` に書く（例: 「新規作成 wizard を開き、3 ステップ入力して保存し、一覧に行が出る」）。「子 Story 全実装」「mock 除去完了」「主要画面の突合済み」のような中間指標は完了条件にしない
2. 移植元の全画面と全 API endpoint を列挙し、移植先の対応 path と突き合わせる（下記「列挙」）。サンプリングや「主要画面のみ」で範囲を狭めない
3. 移植元の構成図を diagram-render の draw-diagram skill で書き、HTML にする。その図を文脈を持たないサブエージェントに 1 回確認させる。サブエージェントは `subagent_type` に `general-purpose` などを指定し、会話履歴を引き継ぐ fork にしない。確認するのは、列挙の各行がノードとして、行同士のやり取りが正しい向きのエッジとして表れているかである。指摘はメインエージェントが直して再レンダリングする
4. 移植先の AGENTS.md・README・レイアウトと命名とレイヤーの規約を読み、移植元の図を複製して `000004-main-target-diagram.md` に組み直す。移植先に無いノードは消さずに `missing` と注記し、列挙の `missing` と一致させる。手順 3 と同じ要領で、ノードの網羅と移植先規約への適合を確認させる
5. outcome ごとに実装する。1 PR が宣言する outcome は 1 つだけにする。複数の outcome が要るなら PR を分け、Issue 側で sub-issue や blocked-by を張る（gh-projects plugin の epic-story-task の形）。ユーザーがこの skill を呼び出したことを、個人ルールでいう「作業を別 PR に分ける明示的な指示」として扱う
6. PR を出す前に、移植先アプリをローカルで起動して outcome のフローを実際に通し、各ステップのスクリーンショットを `000006-main-screenshots/<flow-name>/` に保存する。途中で詰まったら PR を出さずに直して再検証する
7. PR 本文（下記テンプレート）とコミットメッセージを書き、`${CLAUDE_SKILL_DIR}/scripts/check-shrink-vocab.ts <file>` で縮小語彙を検査してから PR を出す

ユーザーが手順の途中で完了宣言を求めたら、残っている手順と作業を示してから判断を仰ぐ。

## 列挙

`000002-main-enumeration.md` の形式:

```markdown
# 000002 Enumeration

source repo: <org/repo@sha>
target repo: <org/repo@sha>
enumerated at: <yyyy-mm-dd HH:MM>

- `/users/new` (UI) → `/admin/users/new`: 1:1
- `POST /api/users` (API) → `POST /admin/api/users`: behavior-diff（画像アップロードが別 API に分割されている）
- `/users/:id/edit` (UI) → (none): missing
```

すべての行の状態を `1:1` / `missing` / `behavior-diff` のいずれかにし、`TBD` を残さない。`behavior-diff` には差分を 1 行で添え、`missing` には補完する PR を紐付ける。

## 縮小語彙

`check-shrink-vocab.ts` は次の語を検出し、検出があれば exit 1 で終わる。`## 未対応の残作業` 見出しの配下は、明示された残作業として許可される。

- 部分対応の糊塗: `(編集モード)のみ対応`、`subset`、`部分対応`、`as-is`
- 完了に見せる骨格: `骨格`、`walking skeleton`、`mock 除去`、`機能パリティ`
- 検証の先送り: `後続 PR で対応`、`次の PR で`、`レビュー後にローカルで確認`、`merge 後にローカル確認`

検出されたら、その行を `## 未対応の残作業` の下へ移すか、実際に対応して書き換える。

## PR 本文テンプレート

`000005-main-pr-bodies/<outcome-slug>.md` に書いてから PR に使う。

```markdown
## Outcome

ユーザーが手元で <具体的な 1 周フロー> を通せる（スクリーンショット添付済み）。

## 突合スコープ

<000002-main-enumeration.md の該当行をそのまま引用>

## 検証スクリーンショット

- `000006-main-screenshots/<flow-name>/01-start.png`
- `000006-main-screenshots/<flow-name>/02-input.png`

## 未対応の残作業

<部分対応や設計差異がある場合だけ書く>

## Relates

Relates to #<issue>
```
