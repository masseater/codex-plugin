---
name: autopilot
disable-model-invocation: true
description: SDD の spec を、ユーザーの確認を最小限にして steering の確認から最後の Phase の検証まで自動で進める。
argument-hint: "[spec 名 | 新しい spec の説明] [開始する Phase 番号]"
---

# SDD autopilot

引数: `$ARGUMENTS`

ユーザーが見ていない前提で、spec を最後の Phase の検証まで進める。各段階の手順は、それぞれの skill の参照ファイル（`../<skill>/references/*.md`）を読んで自分で実行する。参照ファイルの `<skill-dir>` は `../<skill>`、`<plugin-root>` は `../..` に読み替える。サブエージェントに段階ごと委譲しない。段階の間で文脈を引き継げなくなるため。

## 進め方

```text
if .claude/skills/steering/ does not exist:
  stop and ask the user to run /sdd:steering           # 方針がないと判断の基準がない

if $ARGUMENTS names no existing spec:
  run spec init with $ARGUMENTS as the description

loop:
  state = spec-state.ts specs <spec>                   # ../status/scripts/spec-state.ts
  record state.next.command in the task list (TodoWrite, or TaskCreate / TaskUpdate)
  if state.next.command is "/sdd:archive" or "overview.md の status を completed にする":
    break
  if the same next.command repeats 3 times without the state changing:
    stop and report what is stuck                       # 同じ段階で空回りしている
  if state.next.command starts with "/sdd:phase plan" and validate spec has not run in this autopilot:
    run validate spec and fix its findings first       # spec-state.ts は validate spec の実施を記録しないため
  do the step that state.next.command names, following its reference file

report: 進めた段階、作ったファイル、残った **不明**、止まった理由（あれば）
```

## 自分で判断してよいこと

- 技術的な選択肢: ステアリング（tech.md / structure.md）と調査結果に最もよく合う案を選び、選んだ理由を spec 文書に 1 行書く
- 参照ファイルが指示する `AskUserQuestion`: 下の「止まる条件」に当たるもの以外はすべて、上の基準に従って自ら決める。決めた内容は最後の報告に含める（例: spec 名、Phase 構成の承認、非機能要件の選択、validate 後の対応方針、品質チェックのコマンド）
- validate の指摘: high と medium は直し、low は報告に残す

## 止まる条件

次の場合だけ、作業を止めてユーザーに報告する。それ以外の場面では、報告のために止まらず次の段階へ進む。

- ステアリングがない
- clarify で扱う `**不明**` が、業務ルールや範囲など、ユーザーの意思決定がないと決められない内容である（技術的な不明は research として自分で調べて決める）
- 同じ Phase のテスト・型チェックが、直す試みを 2 回しても通らない
- push・外部サービスへの書き込み・データの削除など、元に戻せない操作が必要になった
