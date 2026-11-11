---
name: epic-story-task
description: GitHub Projects を EPIC - Story - Task の 3 階層と sub-issue / blocked-by の依存関係で運用する方法論。GitHub Issue / Projects で EPIC・Story・Task の階層を設計するとき、Story の分け方・Issue body の書き方・close の扱いを判断するときに使う。
---

# EPIC - Story - Task

起票・分解・依存登録の手順は `/gh-projects:epic-plan`（ユーザーが呼び出す）、棚卸しは `epic-review`、単発の CLI 操作は `/gh-projects:cli`（ユーザーが呼び出す）を使う。

## 階層

- EPIC: プロダクト / プロジェクトレベルの目標。「ログイン体験の向上」のように成果の視点で書き、「認証実装」のような実装の視点は Story 以下に降ろす
- Story: EPIC を実現する成果の単位。次の 2 種類だけを、EPIC を分解する時点で確定する
  - 全体リリース Story（1 つ）: EPIC の全体を、意図どおりの完成物として一度に作り切ってリリースする
  - 機能別 検証 Story（機能ごと）: リリース後、機能ごとに意図どおり実装されているかを確認し、相違があるときだけ直す
- Task: 全体リリース Story の作業分解。必要なときだけ作る

## Story の分け方

段階的に進めるための分割はしない。「まず最小限、後の Story で機能追加」と積み上げると、どの時点で完成物になるかが曖昧になり、「後で直す」前提で完成基準が下がるため。

- 作業時間や規模を分割の根拠にしない。「大きいから分ける」「小さいからまとめる」はしない
- 機能 A・機能 B のようにフェーズで全体リリース Story を分けていたら、1 つに統合する
- 検証 Story は意図と実装のズレを捕まえる保険で、機能追加や改善の置き場ではない。修正なしで確認を終えられるのが理想
- 意味の単位が違う（ユーザー価値の単位と実装の単位が混ざっている）ときは、階層のレベルを誤っていないか疑う

## 依存関係

依存関係の正本は Issue の関係（sub-issue と blocked-by）で、body ではない。

- 親子（EPIC ↔ Story、Story ↔ Task）は sub-issue で表す
- 横方向の前後関係は blocked-by で表す。並行で進められる作業を親子に押し込めると並行性が失われるため
- 検証 Story は全体リリース Story に blocked-by でつなぐ（リリース後に確認するため）
- 「順番に着手したいだけ」なら blocked-by を付けない。本当に並行できないものだけにする
- EPIC 間の依存は blocked-by より Project の Iteration / Group で表すと読みやすいことが多い
- EPIC / Story / Task はすべて同じ Project に登録する

## body の書き方

目的・達成したい状態・成功の判断基準だけを書く。実装方法・設計詳細・コードを書くと目的と手段が混ざって実装の自由度を奪い、子 Issue のリンク一覧を書くと Issue の関係と二重管理になって乖離する。Issue のタイトルと本文は英語で書く。テンプレートは `../../assets/issue-body-templates.md`。

## 完了と close

- 作業・確認が済んだら status を Need Review にする。close は人間が行い、自動では close しない
- 検証 Story は確認後も close せず Need Review にし、確認手順と根拠（スクリーンショット / ログ / 実機確認）を Story にコメントで残す。確認が途中でもコメントは随時残す
- 親（EPIC / Story）は、子がすべて Need Review 以降になってから Need Review にする
