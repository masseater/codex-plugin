---
name: find-masseater-component
description: masseater/codex-plugin の skill・agent・hook を検索・一覧表示する。検索元は各 plugin の AGENTS.md の一覧である。「あのスキル何だっけ」「〜する skill はあるか」「どんなスキルがあるか」と聞かれたときに使う。手動呼び出し専用（disable-model-invocation）の skill は description がコンテキストに載らないので、名前を思い出せないときはこれで探す。
argument-hint: "[keyword ...]"
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/list-components.ts), Bash(${CLAUDE_SKILL_DIR}/scripts/list-components.ts *), Read
---

# find-masseater-component

```bash
${CLAUDE_SKILL_DIR}/scripts/list-components.ts $ARGUMENTS
```

- キーワードを渡すと、plugin 名・名前・説明のいずれかに含むものに絞る。無ければ全件を plugin ごとに出す
- リポジトリは cwd の git ルート（worktree を含む）、無ければ `~/.claude/plugins/marketplaces/masseater-plugins` から探す。どちらでもなければ `--root <repo-root>` を付けて再実行する

出力をそのまま見せる。ユーザーが特定のコンポーネントの詳細を求めたら、次のファイルを読んで要約する。

- skill: `plugins/<plugin>/skills/<name>/SKILL.md`
- agent: `plugins/<plugin>/agents/<name>.md`
- hook: `plugins/<plugin>/hooks/entry/<name>.ts`。無ければ `plugins/<plugin>/hooks/` 配下を `<name>` で探す（`install-deps.sh` などがある）
