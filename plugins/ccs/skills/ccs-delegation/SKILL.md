---
name: ccs-delegation
description: CCS CLI（`ccs <profile> -p "<task>"`）で、範囲が明確な作業を別モデルのプロファイル（glm / kimi など）に委譲する。続きは `ccs <profile>:continue` で頼む。範囲が明確な作業とは typo 修正、テスト追加、単純なリファクタ、ドキュメント更新などである。ユーザーが「use ccs <task>」「use ccs:continue <follow-up>」「ccs に任せて」と頼んだときに使う。
---

# ccs-delegation

## 委譲してよい作業

- 範囲と完了条件がはっきりした作業: typo 修正、テスト追加、単純なリファクタ、JSDoc やドキュメントの更新
- 次は委譲せずメインで行う: 設計判断、セキュリティに関わるコード、原因調査が要るデバッグ、性能改善、破壊的変更や移行。ユーザーが委譲を求めても、これに当たる場合はその旨を伝えてから判断を仰ぐ

## 新規の委譲（「use ccs [--<profile>] <task>」）

1. タスク文に `--<profile>` があればそのプロファイルを使い、フラグをタスク文から除く
2. 無ければプロファイルを選ぶ。`~/.ccs/config.yaml`（古い CCS では `~/.ccs/config.json`）の profiles からプロファイル名を読む。どちらも無ければ「CCS が未設定。`ccs doctor` を実行する」と伝えて止まる

   ```text
   characteristics(name):
     /^glm/i    → cost=low,    context=standard, reasoning=false
     /^kimi/i   → cost=medium, context=long,     reasoning=true
     /^claude/i → cost=high,   context=standard, reasoning=false
     その他      → cost=low,    context=standard, reasoning=false

   if タスクが推論を要する（think / analyze / reason / debug / investigate / evaluate）:
     候補 = reasoning=true のプロファイル（kimi を優先）
   elif タスクが広範囲を読む（architecture / entire / all files / codebase）:
     候補 = context=long のプロファイル（kimi を優先）
   else:
     候補 = cost=low のプロファイル（glm を優先）
   選択 = 候補[0] ?? "glm"（存在すれば） ?? プロファイル一覧[0]
   ```

3. 委譲先は会話の文脈を持たないので、プロンプトを補う。対象ファイルのパス、現在の実装の要点、期待する挙動、完了条件を書き足す。タスク文の先頭がスラッシュコマンド（`/commit` など）ならそのまま先頭に残す
4. `ccs <profile> -p "<補ったプロンプト>"` を Bash で実行する。委譲先の実行は 10 分近くかかることがあり、Bash ツールの既定タイムアウトより長いので、`timeout` を 600000 にするか `run_in_background` で実行する
5. 選んだプロファイルと理由、コスト（USD）、所要時間、セッション ID、終了コードを報告する。成果物は差分を見て確かめる

## 継続（「use ccs:continue [--<profile>] <follow-up>」）

1. `~/.ccs/delegation-sessions.json` から最新のセッションのプロファイルを読む。セッションが無ければ「先に新規の委譲が必要」と伝えて止まる
2. `--<profile>` があればそちらに切り替える
3. 前回の成果と残作業を確かめ、プロンプトに前回の文脈・未完了の項目・完了条件を書き足す
4. `ccs <profile>:continue -p "<補ったプロンプト>"` を、新規の委譲と同じく `timeout` 600000 か `run_in_background` で Bash 実行する
5. プロファイル、セッション番号、今回と累計のコスト、所要時間、終了コードを報告する

## 失敗したとき

エラーメッセージから [troubleshooting.md](references/troubleshooting.md) の該当項目を探して対処する。

ユーザーの CLAUDE.md に委譲の方針を書きたい場合は [CLAUDE.md.template](CLAUDE.md.template) を使う。
