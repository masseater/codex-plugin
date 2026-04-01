---
name: context:refactor-context-file
description: コンテキストファイル（CLAUDE.md/AGENTS.md）をClaude Codeの各機能に分解・リファクタリングする
argument-hint: "[file-path]"
allowed-tools: Read, Write(.claude/**), Write(~/.claude/**), Bash(ls), Bash(mkdir), Glob, Grep, TodoWrite, AskUserQuestion, Skill(cc-hooks-ts:cc-hooks-ts), Skill(research:semtools), Skill(context:should-be-project-context)
---

# コンテキストファイルのリファクタリング

コンテキストファイルを Claude Code の機能（commands, agents, skills, rules, hooks）に分解する。

## 実行手順

### 0. ファイルパス検証

`$ARGUMENTS` が空の場合、以下のメッセージを出力して終了:

```
エラー: ファイルパスを引数に指定してください
使用方法: /context:refactor-context-file [file-path]
```

ファイルが存在しない場合もエラー終了。

### 1. Skill を読み込む

以下の Skill を読み込む:

- `claude-code-features`: Claude Code の各機能（commands, agents, skills, rules, hooks）を理解
- `should-be-project-context`: 分割基準（コロケーションの原則、AGENTS.md 階層設計）を理解

### 2. 出力先の決定

入力ファイルのパスから出力先を自動判定:

- `~/.claude/` 配下のファイル → `~/.claude/` に出力
- それ以外 → `.claude/` に出力（プロジェクト用）

### 3. ファイル読み込み・解析

- 指定ファイルを読み込む
- `@file` 参照は展開せず、参照として記録
- Markdown セクション（##, ###）で分割

### 4. コンテンツ分類

`claude-code-features` Skill と `should-be-project-context` Skill の分割基準に従って、各セクションを分類する。

### 5. 分解計画の提示

分類結果を一覧表でユーザーに提示

ユーザーの確認を得てから次へ進む。

### 6. ファイル生成

各カテゴリに応じてコマンド/Skill を呼び出すtodoを追加する。

| カテゴリ | 呼び出し方法                   |
| -------- | ------------------------------ |
| Hooks    | `cc-hooks-ts` Skill を使用     |
| Rules    | `.claude/rules/` に直接作成    |
| Skills   | `.claude/skills/` に直接作成   |
| Agents   | `.claude/agents/` に直接作成   |
| Commands | `.claude/commands/` に直接作成 |
