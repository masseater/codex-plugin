---
description: backend スタック — Hono、Drizzle ORM、better-auth、awilix、環境変数の検証、エラーハンドリングの規約
---

# backend スタック

- フレームワーク: Hono
- ORM: Drizzle ORM
- 認証: better-auth（Google OAuth 2.0）
- DI: awilix
- 環境変数の検証: t3-env
- エラーハンドリング: fail fast（Philosophy 参照）

## Hono

- 新規プロジェクトの backend は Hono を既定にする
- デプロイ先は Cloudflare Workers を優先し、Node.js adapter は次善とする
- ルートはリソースごとに 1 ファイルへ分け、`app.route()` で登録する
- フロントエンドとの型共有には Hono RPC（`hc`）を使う
- 認証・ログ・エラーハンドリングなど横断的な処理は middleware（`app.use()`）に置く
- リクエスト・レスポンスの検証は `@hono/valibot-validator` と valibot のスキーマで行う
- リクエスト単位の依存は型付き context（`new Hono<{ Variables: AppVars }>()`）の `c.var` で渡す

## Drizzle ORM

- スキーマは `src/db/schema/` に、テーブルまたはドメイン単位で 1 ファイルずつ置く
- マイグレーションは Drizzle Kit（`drizzle-kit generate` → `drizzle-kit migrate`）で行う
- CRUD に生 SQL を書かず、query builder を使う
- relation はテーブル定義と同じスキーマファイルに書く

## better-auth

- provider の設定は `src/auth.ts` の 1 モジュールにまとめる
- 既定の provider は Google OAuth 2.0
- セッションは失効させられるよう、JWT だけでなく DB に保存する

## awilix

- container はリクエストごとに作る（scoped lifetime）。singleton にしない
- サービスは `asFunction()` か `asClass()` で登録し、`asValue()` は使わない
- container の構成は `src/container.ts` の 1 モジュールにまとめる

## 環境変数

[t3-env](https://env.t3.gg/) で検証と型付けを行う。`env.ts` を 1 つ定義してそこから import し、`env.ts` の外で `process.env` を読まない。Next.js 以外の backend では `@t3-oss/env-nextjs` ではなく `@t3-oss/env-core` を使う。`skipEnvValidation` は使わず、ダミー値の注入で対応する（`references/coding-standards.md`）。

## エラーハンドリング

- エラーは最上位のエラーハンドラまで伝播させ、catch して無視しない
- ドメインエラーは汎用の `Error` ではなく型付きのエラークラスにする
- エラーハンドラはエラーに応じた HTTP ステータスを返し、エラーを 200 で返さない
