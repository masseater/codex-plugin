---
description: CLI スタックと規約 — Bun、citty、oxlint/oxfmt、TypeScript の書き方、スクリプトの引数規約、ダミー実装の例
---

# CLI スタック

CLI ツール開発の技術スタックと規約。

## 技術スタック

すべて必須。最低バージョンの指定があるものは、それ以上の最新版を使う。欠けている項目は重大な違反として報告する。

- 言語: TypeScript
- ランタイム: Bun
- 型チェック: @typescript/native-preview（tsgo）v7 以上。tsc は使わない（同じ意味論で約 10 倍速いため）
- linter / formatter: oxlint + oxfmt。ツールと設定方針は `references/quality-automation.md` と同じ
- CLI フレームワーク: citty v0.1.6 以上
- 色付き出力: chalk v5.6.2 以上
- プログレスバー: cli-progress v3.12.0 以上
- 未使用コード検出: knip

## 環境変数

[valibot](https://valibot.dev/) で起動時に検証する。`env.ts` を 1 つ定義してそこから import し、`env.ts` の外で `process.env` や `Bun.env` を読まない。

```typescript
// src/env.ts
import * as v from "valibot";

const EnvSchema = v.object({
  API_TOKEN: v.pipe(v.string(), v.minLength(1)),
  LOG_LEVEL: v.optional(v.picklist(["debug", "info", "warn", "error"]), "info"),
});

export const env = v.parse(EnvSchema, process.env);
```

## TypeScript

SKILL.md の Philosophy に加えて、型定義は `interface` ではなく `type` で書く。外部ライブラリの型を拡張する場合だけ例外とし、その旨をコメントに書く。

## スクリプト

- Bun で直接実行できる TypeScript ファイルにし、shebang を付ける
- 引数はオプション形式だけにし、位置引数を使わない。サブコマンドだけは位置引数でよい

```bash
# OK
./hoge.ts

# NG
bun run hoge.ts

# 引数付き
# OK
./hoge.ts --fuga "fuga" --piyo

# NG
./hoge.ts "fuga" piyo
```

## ダミー実装・NO-OP の例

Philosophy で禁止しているものの具体例。

```typescript
// NG: 何もしない関数
function doSomething() {
  // TODO: implement later
}

// NG: 常に true を返す検証
function validate(input: string): boolean {
  return true; // 実際には何も検証していない
}

// NG: エラーの握りつぶし
try {
  riskyOperation();
} catch {
  // 何もしない
}
```
