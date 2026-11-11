---
description: スタック共通のコーディング規約 — 環境変数の検証パターン（isDummy / DUMMY_ENV）と process.env を読んでよい境界
---

# スタック共通のコーディング規約

Philosophy をすべてのスタックで実装するための具体的なパターン。

## 環境変数の検証

`skipEnvValidation` など検証を無効にするオプションは使わず、検証は常に実行する。CI・lint・typecheck などで実値を使えないときは、ダミーの環境変数を注入する。

### `isDummy` と `DUMMY_ENV`

- `isDummy`: ダミー注入を有効にするかの真偽値
- `DUMMY_ENV`: 必須の環境変数すべてのダミー値。`process.env` の代わりとして `runtimeEnv` へ渡す

`isDummy` の条件式は、必ず false になるべき条件（ガード）を先に、ダミー注入を許す条件を後に書く。`!== "production"` が先に短絡評価されるので、他の条件がどうであっても本番にダミー値が入らない。

```ts
// env.ts（Next.js では @t3-oss/env-nextjs の createEnv を使う）
import { createEnv } from "@t3-oss/env-core";
import * as v from "valibot";

const isDummy =
  // --- false にすべき条件: 本番には決してダミーを入れない ---
  process.env.NODE_ENV !== "production" &&
  // --- true でよい条件: CI、lint、typecheck など ---
  (process.env.CI === "true" || !process.env.DATABASE_URL);

const DUMMY_ENV = {
  DATABASE_URL: "postgresql://dummy",
  REDIS_URL: "redis://dummy",
} as const;

const runtimeEnv = isDummy ? DUMMY_ENV : process.env;

export const env = createEnv({
  server: {
    DATABASE_URL: v.pipe(v.string(), v.url()),
    REDIS_URL: v.pipe(v.string(), v.url()),
  },
  runtimeEnv,
});
```

```ts
// NG: 検証そのものを飛ばす
export const env = createEnv({
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  // ...
});
```

## `process.env` を直接読まない

アプリケーションとライブラリのコードで `process.env` を直接読むのは規約違反とする。環境変数は型付きの境界モジュールで 1 回だけ読んで検証し、ほかの場所はそのモジュールを import する。

`process.env` を読んでよい境界:

- `env.ts` など型付きの env モジュール
- `*.config.ts` などの設定エントリポイント
- プロセス状態を明示的にセットアップする test ファイル
- 宣言ファイル（`*.d.ts`）
