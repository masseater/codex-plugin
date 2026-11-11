---
description: 基盤エコシステム — Node.js、pnpm、Turborepo、tsx、Bun、mise、スクリプト実行の方針、monorepo の構成
---

# 基盤エコシステム

Web・backend・CLI のどのスタックにも共通する基盤。

## ツール

- Node.js（最新の LTS か current）: ランタイム
- pnpm: パッケージマネージャー
- tsx: プロジェクトのスクリプト実行
- Turborepo: monorepo のタスクランナーとリモートキャッシュ
- Bun: プロジェクト外のツール（AI 向け hook、plugin など）のランタイム

## ツールのバージョン管理

[mise](https://mise.jdx.dev/) を使い、プロジェクトルートの `.mise.toml` で Node.js・pnpm などのバージョンを固定する。人と AI が同じバージョンを使うようにするため。環境変数・タスク・ローカル上書き（`.mise.local.toml`）を扱えるので、`.tool-versions` ではなく `.mise.toml` を使う。

```toml
# .mise.toml — セットアップ時点の最新版を使う
[tools]
node = "25.0.0"
pnpm = "10.12.1"
```

## スクリプト実行の方針

- プロジェクトのスクリプト（dev、build、test、マイグレーション）は pnpm + tsx で実行する。プロジェクトの依存グラフの一部であり、lockfile で再現できるため
- AI コーディングエージェントの hook・plugin・外部ツールは Bun で実行する。プロジェクトの一部としてではなく、lockfile へ依存しない独立したランタイムとして動かすため

プロジェクトのスクリプトは `pnpm tsx <script>` か package.json の scripts から実行できるようにし、Bun の API に依存させない。

## デプロイ先

- Next.js（web）: Vercel
- CLI ツール: npm publish
- それ以外: プロジェクトごとに選ぶ

DB とストレージには既定を設けず、サーバーレス対応・コスト・データモデルの適合で選ぶ。

## monorepo

Turborepo と pnpm workspace で管理する。

内部パッケージは `@repo/` スコープにし、`package.json` から `workspace:` プロトコルで参照する。

```jsonc
// package.json
{
  "dependencies": {
    "@repo/ui": "workspace:*",
    "@repo/config": "workspace:*",
  },
}
```

```typescript
// workspace パッケージからの import
import { Button } from "@repo/ui";
import { envSchema } from "@repo/config";
```

共有の型・コンポーネント・ユーティリティは `packages/` に、デプロイするアプリケーションは `apps/` に置く。各パッケージの `package.json` の `name` は `@repo/<name>` にする。

```text
packages/
  ui/          → @repo/ui
  config/      → @repo/config
  db/          → @repo/db
apps/
  web/         → @repo/* を使う
  api/         → @repo/* を使う
```
