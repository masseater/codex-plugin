---
description: cc-hooks-ts の context.json() で返すイベント別の出力構造（PreToolUse / PostToolUse / UserPromptSubmit / PermissionRequest / Stop / SessionStart）
---

# context.json() の出力パターン

## Contents

- 全イベント共通のフィールド
- PreToolUse
- PostToolUse / PostToolUseFailure
- UserPromptSubmit
- PermissionRequest
- Stop / SubagentStop
- SessionStart
- additionalContext の書き方

## 全イベント共通のフィールド

全イベント共通の任意フィールド:

- `continue: false`: Claude の処理を止める。`stopReason` はユーザーに表示され、会話に残るので、会話が続けば Claude も読む
- `systemMessage`: ユーザーに表示する警告。hooks.json で `"async": true` にした hook では表示されず、次のターンで Claude に渡る
- `suppressOutput`: Claude Code は受け付けるが効果はないので付けない

## PreToolUse

```typescript
return context.json({
  event: "PreToolUse",
  output: {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny", // "allow" | "ask" | "deny"（"defer" は claude -p の非対話モードでだけ効き、対話セッションでは無視される）
      permissionDecisionReason: "理由と代わりにすべきこと",
      // updatedInput: { ... }   ツール入力を差し替える
      // additionalContext: "..." ツール結果の隣に Claude への補足を入れる
    },
  },
});
```

- `deny` の `permissionDecisionReason` は Claude に渡る。理由と代替手段を書くと Claude がそのまま直せる
- トップレベルの `decision: "block"` は PreToolUse では非推奨。`permissionDecision` を使う

## PostToolUse / PostToolUseFailure

```typescript
return context.json({
  event: "PostToolUse",
  output: {
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: "lint 結果など、ツール結果に添える事実",
    },
  },
});
```

`updatedToolOutput` でツールの出力を差し替えられる（値はツールの出力の形に合わせる）。MCP ツール専用の `updatedMCPToolOutput` より、全ツールに効くこちらを使う。

## UserPromptSubmit

```typescript
return context.json({
  event: "UserPromptSubmit",
  output: {
    // decision: "block", reason: "..."  プロンプトを処理させない場合だけ付ける
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: "プロンプトに添える情報",
    },
  },
});
```

`decision` は `"block"` か省略のどちらか。additionalContext は毎ターン transcript に積み上がるので、変化があったときだけ返す。

## PermissionRequest

```typescript
return context.json({
  event: "PermissionRequest",
  output: {
    hookSpecificOutput: {
      hookEventName: "PermissionRequest",
      decision: { behavior: "deny", interrupt: true, message: "許可しない理由" },
      // 許可する場合: { behavior: "allow", updatedInput?: {...}, updatedPermissions?: [...] }
    },
  },
});
```

## Stop / SubagentStop

継続させる方法は 2 つ。どちらも `stop_hook_active` と連続 8 回の上限の対象になる。

```typescript
// 想定どおりの補足（transcript には "Stop hook feedback" と表示される）
return context.json({
  event: "Stop",
  output: {
    hookSpecificOutput: { hookEventName: "Stop", additionalContext: "残っている作業の事実" },
  },
});

// エラーとして止める。decision が "block" のとき reason は必須
return context.json({
  event: "Stop",
  output: { decision: "block", reason: "続けるべき理由" },
});
```

## SessionStart

```typescript
return context.json({
  event: "SessionStart",
  output: {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: "会話の先頭に入れる環境情報",
    },
    // systemMessage: "ユーザーにだけ見せる通知"
  },
});
```

SessionStart の plain stdout はそのまま Claude のコンテキストに入る。インストールログなどは stderr に出す。

## additionalContext の書き方

命令ではなく事実として書く（「この repo のテストは `bun test`」）。system 命令風の文面は prompt injection 防御を誘発し、Claude がユーザーに転送するだけになることがある。
