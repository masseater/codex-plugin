---
description: 品質自動化 — oxlint、ESLint custom plugin、oxfmt、steiger、tsgo、knip、lefthook、Renovate、CI の必須チェック、claude-code-action による自動修正、チェックは lint rule で書く方針
---

# 品質自動化

## 目次

- チェックはスクリプトではなく lint rule で書く
- ツール
- oxfmt: ルートで実行する
- oxlint: 汎用の lint
- ESLint: 型情報と構造のルール
- 使い分け
- Vitest の test ファイル制約
- 使わない ESLint ルール
- 独自ルール enforce-barrel-import
- `@repo/lint-config` と monorepo での実行単位
- ツールの呼び出し方
- CI の必須チェック
- 依存更新: Renovate
- main の CI 失敗の自動修正: claude-code-action
- 文書の自動化

Philosophy の「すべてを機械的に検出できるようにする」を実現する具体的なツール。

## チェックはスクリプトではなく lint rule で書く

チェックを自動化するときは、単独のスクリプトではなく oxlint / ESLint の custom plugin を書く。スクリプトは実行し忘れられるが、lint rule は `pnpm run check` に乗って CI・lefthook・エディタ・AI エージェントのすべてで走り、違反をファイル名と行番号付きで報告できる。自動修正できるものは `--fix` も実装する。「このパターンを検出したい」と思ったら、まず lint rule にできないかを考える。

## ツール

- oxlint: 主 linter
- oxfmt: formatter
- ESLint（v9 以上）: 独自ルール、型情報を使うルール、アーキテクチャ境界の強制
- steiger: FSD アーキテクチャの lint
- tsgo（TypeScript v7 以上）: 型チェック
- knip: 未使用コード検出
- lefthook: Git hooks 管理
- Renovate: 依存の自動更新

## oxfmt: ルートで実行する

oxfmt は monorepo のルートでだけ実行し、workspace ごとには実行しない。フォーマットは monorepo 全体で統一し workspace ごとの差を認めないため、またルートの設定ファイルや共有スクリプトも一度で揃えられるため。workspace の `check` は lint だけを担う。

```jsonc
// package.json（monorepo ルート）
{
  "scripts": {
    "check": "eslint && oxfmt --check . && turbo run check",
    "check:fix": "eslint --fix && oxfmt . && turbo run check:fix",
  },
}
```

## oxlint: 汎用の lint

主 linter として使う。カテゴリは correctness を warn/deny、suspicious と perf を warn にする。style・pedantic・restriction・nursery は既定（allow）のままにし、プロジェクトで使うルールだけを個別に有効にする。

- プロジェクト固有のルールは oxlint JS plugin（ESLint v9 互換 API、alpha）として書き、`oxlint.config.ts` の `jsPlugins` で設定する。既存の ESLint plugin も多くはそのまま動くが、頼る前に 1 つずつ動作を確かめる
- 型情報を使うルールには oxlint を使わず、ESLint + typescript-eslint を使う
- monorepo では turbo で workspace ごとに実行する。各 workspace の `oxlint.config.ts` は `@repo/lint-config` の `oxlintBase` を import して拡張する。turbo が workspace ごとに走るので、base だけで足りる場合も設定ファイルは置く

## ESLint: 型情報と構造のルール

oxlint でできないことに限って併用する。

- 型情報を使うルール: typescript-eslint の typed linting（no-floating-promises、no-unsafe-\* など）
- アーキテクチャ境界: eslint-plugin-boundaries で FSD の層間 import を制約する
- import の方針: eslint-plugin-import-x で循環依存の検出と並び順
- ドメイン固有ルール: リポジトリ内に `.ts` の local custom plugin を作り、`eslint.config.ts` で import する（npm publish しない）
- TanStack Query: @tanstack/eslint-plugin-query

独自ルールには `fix()` を実装する。

ルートと workspace の役割:

- ルートの `eslint.config.ts`: リポジトリ構造のルール（plugin.json、hooks.json、package.json の独自ルールなど JSON の lint）。ルートで 1 回だけ実行する
- workspace の `eslint.config.ts`: TypeScript/TSX の型情報を使うルール、アーキテクチャ境界、ドメイン固有ルール。turbo で workspace ごとに実行する。`@repo/lint-config` の `eslintBase` を import して展開し、base だけで足りる場合も設定ファイルは置く

## 使い分け

- 汎用の正しさ・スタイル: oxlint
- プロジェクト固有の AST ルール: まず oxlint JS plugin、安定性が要るなら ESLint
- 型情報が要るルール: ESLint + typescript-eslint（oxlint は type-aware lint に未対応）
- アーキテクチャ境界: ESLint + eslint-plugin-boundaries
- 循環依存の検出: oxlint（`import/no-cycle`、モジュールグラフを使うので遅くならない）か ESLint
- 両方を使うときは `eslint-plugin-oxlint` で重複ルールを ESLint 側から外す

## Vitest の test ファイル制約

`@vitest/eslint-plugin` の `strict` preset を基準にし、プロジェクト固有の制約を重ねる。test ファイルにだけ適用する。理由は `references/test.md`。

```typescript
// eslint.config.ts
import vitest from "@vitest/eslint-plugin";

export default [
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    extends: [vitest.configs.strict],
    rules: {
      "vitest/no-restricted-matchers": [
        "error",
        {
          toBeTruthy: "Use `toBe(true)` or a more specific matcher",
          toBeFalsy: "Use `toBe(false)` or a more specific matcher",
          toBeDefined: "Assert the specific expected value instead",
        },
      ],
      "vitest/no-hooks": "error",
    },
  },
];
```

test ファイルでの `let` 禁止は、`vitest/no-hooks` で `let x; beforeEach(() => { x = ... })` という主な動機を潰したうえで、規約とレビューで守る。`no-restricted-syntax` は使わない（次節）。

## 使わない ESLint ルール

- `no-restricted-imports`: flat config はキーごとに配列をマージするので、複数の設定エントリで定義すると最後の 1 つだけが効き、制約が黙って消える。eslint-plugin-import-x のルールか custom plugin を使う
- `no-restricted-syntax`: 同じ理由。local custom plugin を書く

## 独自ルール enforce-barrel-import

`index.ts` があるディレクトリでは、その `index.ts` をディレクトリの公開 API とみなし、`index.ts` 経由で import させる。local ESLint custom plugin として書く。`shared/` で、すべてのディレクトリに index.ts を要求する `fsd/public-api` の代わりに使う。

判定: import パスを解決し、最も近いディレクトリに `index.ts`（または `index.tsx`）があるのに、それより深いファイルを指していればエラーにする。

```text
src/shared/api/fuga/index.ts  あり
src/shared/api/fuga/client.ts あり
src/shared/api/hoge.ts        あり（親に index.ts なし）

import { x } from "@/shared/api/fuga/client"  // NG — index.ts があるので "@/shared/api/fuga" を使う
import { x } from "@/shared/api/fuga"          // OK — 公開 API（index.ts）経由
import { x } from "@/shared/api/hoge"          // OK — 親に index.ts が無いので直接 import してよい
```

## `@repo/lint-config` と monorepo での実行単位

oxlint と ESLint の base 設定を 1 パッケージにまとめ、`oxlintBase` と `eslintBase` を export する。

```text
packages/
  lint-config/                → @repo/lint-config
    oxlint.config.ts          → oxlint base（categories, rules, ignorePatterns）
    eslint.ts                 → ESLint base（typescript-eslint, eslint-plugin-oxlint）
    index.ts                  → re-export: { oxlintBase, eslintBase }
```

- oxfmt: ルートだけ
- oxlint: workspace ごと（turbo）。workspace でルールが異なりうるため
- ESLint（コード）: workspace ごと（turbo）。型情報を使うルールが workspace の tsconfig に依存するため
- ESLint（JSON・構造）: ルートだけ

## ツールの呼び出し方

lefthook・Claude Code hooks・CI から node_modules のバイナリを直接呼ばず、package.json の scripts で包んでそれを呼ぶ。フラグや設定パスの定義を 1 か所にし、`pnpm run` で一覧でき、どこから呼んでも同じ挙動にするため。

`package.json` の scripts は `rtk` のようなグローバルインストールしたラッパーへ依存させない。新しい checkout でもプロジェクトが宣言したツールチェーンとランタイム（`pnpm`、`bun`、`tsx` など）だけで動くようにする。出力を圧縮したいなら、ラッパーは呼び出し側（シェルの alias、CI のステップ、エージェントの起動側）で掛ける。

```jsonc
// package.json（workspace）
{
  "scripts": {
    "check": "oxlint",
    "check:fix": "oxlint --fix",
    "typecheck": "tsgo --noEmit",
    "test": "vitest run",
  },
}
```

```jsonc
// package.json（monorepo ルート）
{
  "scripts": {
    "check": "eslint && oxfmt --check . && turbo run check",
    "check:fix": "eslint --fix && oxfmt . && turbo run check:fix",
    "typecheck": "turbo run typecheck",
  },
}
```

```yaml
# lefthook.yml — OK
pre-commit:
  commands:
    check:
      run: pnpm run check

# lefthook.yml — NG
pre-commit:
  commands:
    check:
      run: npx oxlint && npx oxfmt --check
```

## CI の必須チェック

PR と main への push では次の 4 つを通し、ブランチ保護の required status checks に設定する。例外や手動での上書きは認めない。flaky なチェックはスキップせず flaky さを直す。

- lint + format: `pnpm run check`。ルートで ESLint（JSON）+ oxfmt を、turbo で workspace ごとの oxlint + ESLint（コード）を実行する
- 型チェック: `pnpm run typecheck`
- カバレッジ付き test: `pnpm run test:coverage`（Storybook の interaction test を含め、カバレッジ閾値を強制する）
- 未使用コード検出: `pnpm run knip`

AI コーディングエージェント向けの hook は `references/ai-harness.md` に従う。

## 依存更新: Renovate

依存は Renovate で自動更新し、大きく危険な更新が溜まらないようにする。

- automerge: patch・minor・lockfile のみの更新は CI が通れば automerge する。major は移行ガイドと changelog を人が確認するため automerge しない
- CI が壊れ方を検出できないパッケージは、そのパッケージだけ automerge を外して手動でレビューする
- グルーピング: エコシステムや org スコープ単位で 1 PR にまとめる（例: `@tanstack/*`、`eslint-*`）
- 同時に開く PR の上限は 10
- 更新は週末や早朝などのスケジュールでまとめて流し、開発中の作業を妨げないようにする

## main の CI 失敗の自動修正: claude-code-action

main への push で CI が失敗したら、claude-code-action（OAuth 認証）が失敗ログを読んで原因を調べ、修正コミットを main に直接 push する GitHub Action を作る。CI が回帰を検出し、Claude Code が直し、CI が修正を確認するループを人手なしで回すため。API キーではなく OAuth にするのは、権限のスコープと監査証跡を得るため。

トリガーは main の CI 失敗だけにし、PR では動かさない。PR の失敗は作成者が直す。

## 文書の自動化

- JSDoc: export するシンボルすべてに JSDoc を必須にし、欠けていれば lint エラーにする。`@param` と `@returns` は TypeScript の型情報と突き合わせ、矛盾もエラーにする。`@` タグはテキストマッチではなく型・AST のレベルで解析する
- Markdown: プロジェクトの Markdown（README.md、AGENTS.md など）に YAML frontmatter を必須にし、`name` や `description` を機械的に収集できるようにする
- monorepo ルートの AGENTS.md: app・package の一覧を手で書かない。各 app・package の frontmatter（または package.json の `name` と `description`）から自動収集する。収集結果でマーカーコメント（`<!-- BEGIN:xxx -->` / `<!-- END:xxx -->`）の間を置き換える
