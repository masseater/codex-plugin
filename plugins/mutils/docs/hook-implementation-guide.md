# Hook Implementation Guide

hooks/ ディレクトリ内の TypeScript ファイルで実装。cc-hooks-ts を使用。

## 基本テンプレート

```typescript
#!/usr/bin/env bun
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";

using logger = HookLogger.fromFile(import.meta.filename);

const hook = defineHook({
  trigger: { SessionStart: true },
  run: wrapRun(logger, (context) => {
    logger.info("Hook executed");
    return context.success({});
  }),
});

if (import.meta.main) {
  await runHook(hook);
}
```

## トリガー種別

| トリガー       | 説明             | 例                         |
| -------------- | ---------------- | -------------------------- |
| `SessionStart` | セッション開始時 | バージョンチェック         |
| `PreToolUse`   | ツール実行前     | 編集ブロック、権限チェック |
| `PostToolUse`  | ツール実行後     | 通知、後処理               |
| `Stop`         | セッション終了時 | git状態の表示              |

## PreToolUse のツール指定

特定のツールでのみ発火するように指定可能:

```typescript
trigger: {
  PreToolUse: {
    Write: true,
    Edit: true,
  },
}
```

## レスポンスパターン

成功（何もしない）:

```typescript
return context.success({});
```

追加コンテキストを返す:

```typescript
return context.json({
  event: "SessionStart",
  output: {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: "メッセージ",
    },
    suppressOutput: true,
  },
});
```

ツール実行をブロック:

```typescript
return context.json({
  event: "PreToolUse",
  output: {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "ブロック理由",
    },
  },
});
```

## ログ出力先

`$XDG_STATE_HOME/masseater-plugins/` にログを出力（デフォルト: `~/.local/state/masseater-plugins/`）。

## ファイル参照ルール

- hooks.json 内: `../hooks/xxx.ts`
- スキル内: `@../skills/xxx/reference.md`

## 注意事項

- Hooks は複数インスタンスから同時実行される可能性あり
- ファイル書き込みは追記モードを使用
- lib/config.ts に共通設定を配置
