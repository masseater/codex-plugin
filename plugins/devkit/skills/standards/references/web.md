---
description: Web スタック — Next.js App Router、TanStack Query/Form、shadcn/ui、FSD のカスタマイズ、dehydrate パターン
---

# Web スタック

- フレームワーク: Next.js（App Router）
- 状態管理・データ取得: TanStack Query（dehydrate パターン）
- フォーム: TanStack Form + valibot
- UI: shadcn/ui + Tailwind CSS v4

## 環境変数

[t3-env](https://env.t3.gg/) で検証と型付けを行う。`env.ts`（または `env.mjs`）をプロジェクトルートか `src/` に置いてそこから import し、`env.ts` の外で `process.env` を読まない。

```typescript
// src/env.ts
import { createEnv } from "@t3-oss/env-nextjs";
import * as v from "valibot";

export const env = createEnv({
  server: {
    DATABASE_URL: v.pipe(v.string(), v.url()),
  },
  client: {
    NEXT_PUBLIC_API_URL: v.pipe(v.string(), v.url()),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
});
```

## FSD のカスタマイズ（標準の FSD v2.1 との違い）

- 早期分離: 標準の「まず pages に置く」ではなく、早い段階で features / entities に分ける
- `fsd/insignificant-slice` は off にする。1 つの page からしか使わない slice も features / entities に置いてよい
- features のネストには Slice Groups（PR #906 の概念）を使い、`features/[domain]/[action]/` にする。グループのフォルダは構造のためだけのもので、自身の segment や index.ts を持たない
- Next.js との統合: `app/` は Next.js のルーティングに使い、FSD の層は `src/` の中に置く
- `shared/` では `fsd/public-api` を off にする。代わりに独自ルール `enforce-barrel-import`（`references/quality-automation.md`）を使う。このルールは、ディレクトリに `index.ts` があればディレクトリから import させ、無ければファイルの直接 import を許す

## TanStack Query の dehydrate パターン

- QueryClient は `cache()` でリクエストごとに作る
- Server Component で `prefetchQuery` → `dehydrate` → `HydrationBoundary` の順に使う
- staleTime はデータの性質に応じて決める
- v5.40.0 以降の streaming dehydration を使う

## 関連 skill

- `feature-sliced-design` skill が入っていれば、FSD の層構造はそれを読む
- `tanstack-query-best-practices` skill が入っていれば、クエリのパターンはそれを読む
