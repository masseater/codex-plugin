---
name: consecutive-review-loop
description: 履歴を含まない固定プロンプトでサブエージェントにレビューさせ、指摘を直しながら N 回連続で合格するまで繰り返す。「3 回連続でレビューが通るまで回して」「サブエージェントで連続レビュー」と頼まれたときに使う。
argument-hint: "<レビュー対象> <レビュー観点> [N=3] [合格しきい値=medium]"
allowed-tools: Agent, Read, Write, Edit, Glob, Grep, AskUserQuestion
---

# 連続レビューループ

引数: `$ARGUMENTS`

単発の合格は弱い証拠で、レビュアーの見落としや直前の修正による新しい問題を否定できない。互いに独立したレビューで N 回続けて合格すれば、成果物が健全だという強い証拠になる。独立性を保つため、レビュアーには過去のレビューについて何も伝えない。「前回は X を指摘された」と伝えると、レビュアーがその指摘にアンカリングして新しい目で見なくなる。

## パラメータ

- レビュー対象（必須）: ファイルパス、図、設計文書、コードの変更など
- レビュー観点（必須）: レビュアーに与える 1 つの観点（例: 「このシステム図は実装と一致しているか」）
- N: 連続合格の回数。既定 3
- 合格しきい値: この severity 以上の指摘が 0 件なら合格。既定 `medium`（`high` / `medium` / `low` から選ぶ）
- 試行上限: 既定は N × 3 回。レビュー結果が読めない試行（MALFORMED）が 3 回続いた場合も止める。収束しないループを延々と回さず、人が見直せる状態で終えるため

必須パラメータが引数や会話から分からなければ、ループを始める前に `AskUserQuestion` で聞く。

## 手順

```text
flatPrompt  = buildFlatPrompt(target, focus)   # 1 回だけ作り、以後 1 文字も変えない
findingsLog = create "<対象のベース名>-findings-log.md"（対象と同じ場所か .local-agents/）
streak = 0; attempts = 0; malformedStreak = 0
maxAttempts = N * 3

while streak < N:
  if attempts >= maxAttempts or malformedStreak >= 3:
    report "STOPPED — {streak}/{N} streak after {attempts} attempts", the findings log path,
           and the blocking findings from the latest FAIL that remain
    stop
  attempts += 1
  result = spawn new subagent with flatPrompt   # streak・試行回数・過去の指摘・修正内容は渡さない
  if result has no parseable findings list (crash, timeout, malformed):
    malformedStreak += 1
    note "attempt #{attempts}: MALFORMED"; continue   # 合格にも不合格にも数えない
  malformedStreak = 0

  blocking = findings with severity >= threshold
  if blocking is empty:
    streak += 1
    note "attempt #{attempts}: PASS — streak {streak}/{N}"
  else:
    note "attempt #{attempts}: FAIL — streak {streak} → 0"
    streak = 0                                  # 1 減らすのではなく 0 に戻す
    for finding in result.findings:              # しきい値未満も含めて全件トリアージする
      decide valid / invalid / partial, fix valid ones directly with Edit/Write
      append to findingsLog before the next attempt
    re-run the artifact's own checks (compile, lint, test, preview) and fix until they pass

report "DONE — {N} consecutive passes in {attempts} attempts" and the findings log path
```

- 試行ごとの `note` は 1 行にし、次の試行の Agent 呼び出しと同じメッセージに書く。本文だけのメッセージで経過を報告すると、そこでターンが終わってループが途切れる
- ユーザーがループ中に対象や観点を変えたら、streak を捨てて最初からやり直す
- レビューはメインエージェントのセルフレビューで代替しない。メインは履歴を知っているので独立性がなくなる
- レビュアーは Agent ツールの `subagent_type` に `general-purpose` など会話を引き継がない種類を指定して起動し、fork にしない。fork は会話履歴をすべて引き継ぐので、独立性がなくなる

## 固定プロンプト

レビュー対象と観点だけを書き、全指摘を severity と confidence 付きで返させる。合否の判定はメイン側が行う。レビュアーに合否を判定させたり「重大なものだけ」と絞らせたりすると、見つけた問題を報告しなくなるため。

```text
以下の <成果物の種類> を「<観点>」の観点でレビューしてください。
見つけた問題はすべて、次の形式の箇条書きで返してください。問題がなければ「指摘なし」と書いてください。
- [severity: high|medium|low] [confidence: high|medium|low] <場所>: <問題と根拠>

<成果物のパスまたは内容>
```

「これは N 回目」「X は修正済み」「Y に注目して」など、履歴やヒントは書き足さない。

## findings log の形式

追記だけで運用し、不合格の試行ごとに 1 節を足す。合格の試行は記録しない。偽陽性と判断した指摘も理由付きで残す。

```markdown
## Attempt #<n>

- 指摘: <レビュアーの指摘文>（severity / confidence）
  - 妥当性: yes / no / partial — <判断の根拠 1 行>
  - 修正: <変更した箇所と内容。直さないなら「修正なし」>
  - 確認: <compile / lint / test などの結果>
```
