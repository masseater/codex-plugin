---
name: cc-hooks-ts
description: TypeScript ライブラリ cc-hooks-ts（defineHook / runHook / context API）で Claude Code の hook を書くためのリファレンス。hook を新規作成・修正するとき、シェルスクリプトの hook を TypeScript に書き直すとき、cc-hooks-ts の型や応答の返し方を確認するときに使う。
---

# cc-hooks-ts

`bun add cc-hooks-ts` で入れる。イベントごとの入力・出力の仕様は [Claude Code hooks リファレンス](https://code.claude.com/docs/en/hooks)、型の詳細はライブラリの型定義（`node_modules/cc-hooks-ts/dist/index.d.mts`）が正本。ここにはライブラリ固有の使い方と落とし穴だけを書く。

## 基本形

```typescript
#!/usr/bin/env bun
import { defineHook, runHook } from "cc-hooks-ts";

const hook = defineHook({
  trigger: { PostToolUse: { Write: true, Edit: true } },
  // 任意。false を返すと exit 0 で何もしない
  shouldRun: () => process.env.MY_HOOK_ENABLED === "1",
  run: (context) => {
    const filePath = context.input.tool_input.file_path; // trigger のツールに応じて型が付く
    return context.success({});
  },
});

if (import.meta.main) {
  await runHook(hook);
}
```

- `if (import.meta.main)` で囲むと、テストから hook 定義を import しても実行されない。テストでは `defineHook` をモックして `run` を取り出し、偽の `context` を渡して呼ぶ
- ファイルに実行権限（`chmod +x`）を付け、hooks.json の `command` に `"../.."/...` で絶対パスを書く。変数をダブルクォートで囲むと、空白を含むインストール先でも 1 語のまま渡る
- hooks.json の `matcher` はディスパッチ側の絞り込み、`trigger` はコード側の絞り込み。両方を同じツールに揃える。`trigger` に無いツールで起動されると入力の型が合わない

## 応答メソッド

- `context.success(payload?)`: exit 0。`additionalClaudeContext` は SessionStart と UserPromptSubmit でだけ効き、plain text の stdout として Claude のコンテキストに入る。`messageForUser` はそれ以外のイベントで plain text の stdout に出るだけで、debug ログに行き誰にも表示されないので使わない。ユーザーに見せる通知は `context.json` の `systemMessage` で返す
- `context.json({ event, output })`: exit 0 で JSON を出す。`permissionDecision`・`additionalContext`・`decision` などイベント固有の制御はこれを使う。書き方は [response-patterns.md](references/response-patterns.md)
- `context.blockingError(message)`: exit 2。message は stderr 経由で Claude に渡る（イベントにより扱いが違う）
- `context.nonBlockingError(message?)`: exit 1。ユーザーに警告を出して処理は続く
- `context.defer(handler, { timeoutMs })` は使わない。JSON を 2 行出す仕組みで公式仕様に無く、複数行の JSON は parse failure として扱われうる。時間のかかる hook は hooks.json のエントリに `"async": true` を書き、`run` を async 関数にして処理を待ってから `context.json` で結果を 1 回だけ返す。async hook の `additionalContext` と `systemMessage` はユーザーには表示されず、次のターンで Claude に渡る。Claude Code は async hook の `timeout` を強制しないので、外部呼び出しには hook 側で上限を設ける

stdout は hook の制御プロトコルとして解釈されるので、`console.log` でログを出さない。exit 0 の hook の stderr は debug ログにしか行かず、ユーザーと Claude のどちらにも見えない。ログはファイルに書く。

## MCP ツールなどの型を足す

```typescript
declare module "cc-hooks-ts" {
  interface ToolSchema {
    mcp__server__tool: {
      input: { query: string };
      response: { result: string };
    };
  }
}
```

これで `trigger: { PreToolUse: { mcp__server__tool: true } }` の `tool_input` に型が付く。

## Stop hook

Stop hook が継続させる（`decision: "block"` か `additionalContext`）と、Claude が作業を続けたあと再び Stop が発火する。継続中の呼び出しでは入力の `stop_hook_active` が `true` になる。同じ条件で何度も継続させないよう、`stop_hook_active` を見るか、継続回数を自分で数えて上限を設ける。Claude Code 側にも連続 8 回の上限がある。
