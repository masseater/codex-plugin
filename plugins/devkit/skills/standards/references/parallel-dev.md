---
description: git worktree による並行開発 — セットアップの自動化、環境ファイルの分離、ポートの動的割り当て
---

# 並行開発

複数の git worktree を衝突なく並べて動かせるようにプロジェクトを設計する。新しい worktree は、自動化された 1 ステップで開発可能な状態にする。依存のインストール・env ファイルのコピー・ポート設定などの手作業は忘れられるので、残っていればバグとして扱う。

## worktree セットアップスクリプト

新しい worktree の作成時に自動で走る `worktree:setup` スクリプトを用意する。

```jsonc
// package.json
{
  "scripts": {
    "worktree:setup": "tsx scripts/worktree-setup.ts",
  },
}
```

最低限行うこと:

- 依存のインストール（`pnpm install`）。worktree は git オブジェクトを共有するが `node_modules` は共有しないため。lockfile は固定のまま入れ、`--no-frozen-lockfile` を使わない
- 環境ファイルのコピー。`.env.local` などの `.env*.local` を元の worktree からコピーする。secret やローカル設定は git で追跡されないため
- ポート設定の生成。worktree ごとのポートを `.env.local` などに書く
- codegen と DB セットアップ（`prisma generate`、GraphQL codegen、マイグレーションなど）。生成物が新しい worktree に無いため

## 環境ファイルの分離

環境ファイルを symlink で共有せず、worktree ごとにコピーを持たせる。ポートの上書きなどローカルの変更を他の worktree へ波及させないため。コピー元はメインの worktree か、作成を起動した worktree とし、コピー後にポート関連の変数を書き換える。

```typescript
// scripts/worktree-setup.ts — 概念例
import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const mainWorktree = getMainWorktreePath(); // `git worktree list` などから取得
const envFiles = [".env.local", ".env.development.local"];

for (const file of envFiles) {
  const src = resolve(mainWorktree, file);
  if (existsSync(src)) {
    copyFileSync(src, resolve(process.cwd(), file));
  }
}
```

## ポートの動的割り当て

dev サーバー（Next.js、Vite、Hono など）のポートは環境変数 `PORT`（またはフレームワーク固有の `--port`）で変えられるようにし、ハードコードしない。セットアップスクリプトが worktree ごとに一意のポート（基準ポート + worktree の名前か番号から決めたオフセット）を割り当て、`.env.local` に書く。

```typescript
// ポート割り当て — 概念例
import { execFileSync } from "node:child_process";

const BASE_PORT = 3000;
const output = execFileSync("git", ["worktree", "list", "--porcelain"], { encoding: "utf-8" });
const worktreeCount = output.split("worktree ").length - 1;
const port = BASE_PORT + (worktreeCount - 1) * 10; // 3000, 3010, 3020, ...

// .env.local に書き込む
appendToEnvLocal(`PORT=${port}`);
```

```jsonc
// package.json
{
  "scripts": {
    "dev": "next dev --port ${PORT:-3000}",
  },
}
```

## AI エージェントとの連携

AI コーディングエージェントが `gwq` や `EnterWorktree` で worktree を作ったときも、セットアップスクリプトが自動で走るようにする。`post-checkout` の git hook で worktree 作成を検知するか、エージェントの worktree 作成手順で明示的に呼ぶ。エージェントは `pnpm run worktree:setup` を実行するだけで、追加の手作業なしに開発環境が整う状態にする。

## worktree 対応の完了条件

- `pnpm run worktree:setup` があり、セットアップをすべて行う
- dev サーバーのポートを環境変数で変えられる
- `.env*.local` が自動でコピー・書き換えされる
- 新しい worktree で依存がきれいに入る
- codegen とマイグレーションがセットアップに含まれる
- 複数の worktree で dev サーバーを同時に起動してもポートが衝突しない
