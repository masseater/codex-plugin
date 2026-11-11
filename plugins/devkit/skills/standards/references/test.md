---
description: テスト方針 — Vitest、CSF factories 形式の Storybook、ファイルの同居配置、モック方針、禁止パターンと test.extend fixture、カバレッジ
---

# テスト方針

## 目次

- ツールと配置
- 何をテストするか
- モック
- 禁止パターン
- test.extend による fixture
- カバレッジ
- Storybook

## ツールと配置

- test フレームワーク: Vitest
- ビジュアルテスト: Storybook（CSF factories 形式）
- test ファイルはソースの隣に `[name].test.ts`、story はコンポーネントの隣に `[name].stories.tsx` で置く。例: `foo.ts` → `foo.test.ts`、`button.tsx` → `button.stories.tsx`
- `__tests__/` や `__test__/` ディレクトリは使わない。同居させると移動が楽になり、dead code も見つけやすくなるため

## 何をテストするか

各モジュールの公開 API、分岐のあるビジネスロジック、エラーパスとエッジケース（fail fast の挙動を確かめる）、データ変換を優先する。フレームワークの内部、private 関数や内部状態などの実装詳細、ロジックの無い素通し関数はテストしない。

test 名は期待する振る舞いを書く（例: `test("returns empty array when no items match filter")`）。`test("filter works")` のような曖昧な名前や `test("test1")` は使わない。

## モック

- 既定は実装をそのまま使う
- 次に、依存を引数で渡す DI にする
- `vi.mock()` は最後の手段で、外部 I/O（ネットワーク、ファイルシステム、DB）に限る

自分で所有するモジュールはモックしない。内部モジュールをモックしたくなったら結合の問題なので、設計を直す。

## 禁止パターン

ESLint で強制する（`references/quality-automation.md`）。

曖昧な matcher:

- `toBeTruthy()`: `1`・`"str"`・`[]`・`{}` でも通る。真偽値なら `toBe(true)`、それ以外は具体的な matcher を使う
- `toBeFalsy()`: `0`・`""`・`null`・`undefined`・`NaN` でも通る。真偽値なら `toBe(false)`、それ以外は具体的な matcher を使う
- `toBeDefined()`: `!== undefined` しか見ない。期待する値そのものを assert する

共有される可変状態:

- test ファイルの `let`: ある test の変更が次の test に漏れる。`test.extend` の fixture かインラインの setup と `const` を使う
- `beforeEach` / `afterEach`: setup が test 本体から見えなくなる。共有の setup は `test.extend` の fixture、一度きりのものはインラインにする
- `beforeAll` / `afterAll`: 同じ理由。重い共有リソースも `test.extend` の fixture にする

## test.extend による fixture

`test.extend` で test ごとの fixture を宣言する。各 test は分割代入で新しいインスタンスを受け取るので、可変状態の共有とライフサイクル hook のどちらも要らない。

```typescript
import { test as base, expect } from "vitest";

const test = base.extend<{ db: Database }>({
  db: async ({}, use) => {
    const db = await createTestDatabase();
    await use(db);
    await db.cleanup();
  },
});

test("inserts a record", async ({ db }) => {
  await db.insert({ id: 1, name: "foo" });
  expect(await db.findById(1)).toEqual({ id: 1, name: "foo" });
});

test("returns null for missing record", async ({ db }) => {
  expect(await db.findById(999)).toBeNull();
});
```

- setup と teardown は fixture の定義に同居させる
- test は必要な fixture だけを分割代入する（使わない fixture は生成されない）
- fixture は拡張済みの `test` をさらに `extend` して合成する

### 自動 fixture（`auto: true`）

DB の seed やメトリクス収集など、全 test で走らせたいが test 本体では参照しない fixture は、タプル構文で `{ auto: true }` を付ける。分割代入しなくても自動で走る。

```typescript
import { test as base, expect } from "vitest";

const test = base.extend<{ db: Database }>({
  db: [
    async ({}, use) => {
      const db = await createTestDatabase();
      await use(db);
      await db.cleanup();
    },
    { auto: true },
  ],
});

// test が db を分割代入しなくても setup / teardown は走る
test("server responds with 200", async () => {
  const res = await fetch("/api/health");
  expect(res.status).toBe(200);
});
```

参照しない fixture を走らせるために、次の書き方はしない。lint を黙らせるだけで意図が分からなくなるため、`{ auto: true }` で定義する。

- `test("x", ({ _db }) => {})`
- `test("x", ({ db: _db }) => {})`
- `test("x", ({ db }) => { /* 使わない */ })`

## カバレッジ

- プロジェクトごとにカバレッジ閾値（例: 行カバレッジ 80%）を決め、CI で強制する。満たさない PR はマージしない
- 計測には unit test と Storybook の両方を含める。story だけでカバーされたコンポーネントも閾値に数える。`@storybook/addon-vitest` で Storybook の interaction test（`play` 関数）のカバレッジを Vitest に集める
- 新しいモジュールとバグ修正（回帰テスト）には test を必須にする。新しい `.ts` ソースに対応する `.test.ts` が、新しいコンポーネントに対応する `.stories.tsx` があるかを CI チェックか lint rule で確かめる

## Storybook

UI コンポーネントにはすべて、隣に `.stories.tsx` を置く。

story はすべて CSF factories 形式で書く。旧来の CSF 1/2/3（`export default { ... }` と `satisfies Meta`）は使わない。

### セットアップ

1. `package.json` に subpath import を追加する

```json
{
  "imports": {
    "#*": ["./*", "./*.ts", "./*.tsx"]
  }
}
```

2. `.storybook/main.ts` で `defineMain` を使う。framework パッケージは、Next.js（既定の Web スタック、`references/web.md`）なら `@storybook/nextjs-vite` にする。Next.js 以外の React + Vite なら `@storybook/react-vite` にする。interaction test を Vitest で動かす `@storybook/addon-vitest` は Vite 系の framework でしか動かないので、Webpack 系の `@storybook/nextjs` は使わない

```typescript
// .storybook/main.ts（Next.js）
import { defineMain } from "@storybook/nextjs-vite/node";

export default defineMain({
  stories: ["../src/**/*.stories.tsx"],
  addons: ["@storybook/addon-vitest"], // essentials 相当の機能は storybook 本体に含まれる
});
```

```typescript
// .storybook/main.ts（React + Vite）
import { defineMain } from "@storybook/react-vite/node";

export default defineMain({
  stories: ["../src/**/*.stories.tsx"],
  addons: ["@storybook/addon-vitest"], // essentials 相当の機能は storybook 本体に含まれる
});
```

3. `.storybook/preview.ts` で `definePreview` を使う。Next.js では `nextjs.appDirectory: true` を設定する。無いと `next/image`・`next/link`・`next/navigation` などを使うコンポーネントが Storybook 上で実行時エラーになる

```typescript
// .storybook/preview.ts（Next.js）
import { definePreview } from "@storybook/nextjs-vite/preview";

export default definePreview({
  parameters: {
    nextjs: {
      appDirectory: true, // App Router を有効にする
    },
  },
});
```

```typescript
// .storybook/preview.ts（React + Vite）
import { definePreview } from "@storybook/react-vite/preview";

export default definePreview({});
```

### story の書き方

```typescript
import preview from "#.storybook/preview";
import { Button } from "./button";

const meta = preview.meta({
  component: Button,
});

export default meta;

export const Primary = meta.story({
  args: { variant: "primary", children: "Click me" },
});

export const Secondary = meta.story({
  args: { variant: "secondary", children: "Click me" },
});

// .composed で別の story の args を再利用する
export const Large = meta.story({
  args: { ...Primary.composed.args, size: "lg" },
});
```

- preview は相対パスではなく subpath import（`#.storybook/preview`）で import する
- コンポーネントのメタデータは `preview.meta()`、各 story は `meta.story()` で定義する
- preview → meta → story でマージされた値は `.composed` で参照する
- `satisfies Meta` や `StoryObj` の型注釈は書かない（自動で推論される）
- interaction test は `play` 関数で書く。カバレッジに数えられる
