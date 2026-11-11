---
description: skill の scripts/ から GitHub API を呼ぶときの書き方（gh auth token で認証し Octokit を使う）
---

# スクリプトから GitHub API を呼ぶ

ここで扱うのは、skill の `scripts/` に置く TypeScript スクリプトから GitHub API を呼ぶ場合だけ。Claude が対話中に `gh pr view` や `gh issue view` を直接実行するのはこの対象外で、そのままでよい。

## 方針

スクリプトでは `gh auth token` でトークンを取り、`@octokit/rest` で API を呼ぶ。`gh` CLI の出力は版や環境で形が変わり、パースに依存するスクリプトが壊れやすいため。Octokit は型付きの応答を返し、エラー処理・ページネーション・レート制限も扱える。`gh auth token` を使えば追加の認証設定も要らない。

Octokit で実現できないと確かめた操作だけ、スクリプトから `gh` を直接呼ぶ。

## 書き方

```typescript
import { execFileSync } from "node:child_process";
import { Octokit } from "@octokit/rest";

const token = execFileSync("gh", ["auth", "token"], { encoding: "utf-8" }).trim();
const octokit = new Octokit({ auth: token });

const { data: pr } = await octokit.pulls.get({
  owner: "org",
  repo: "repo",
  pull_number: 123,
});
```

外部コマンドは `execFileSync` で呼ぶ。`execSync` は文字列をシェルに渡すので、引数にユーザー入力が混ざるとシェルインジェクションになる。

## 置き換えの例

- `gh api /repos/...` → Octokit の型付きメソッド
- `gh pr list` の出力を grep / awk でパース → `octokit.pulls.list()`
- `gh issue list --json` の出力をパース → Octokit で直接取得
- スクリプト内で `gh pr comment` を繰り返し呼ぶ → `octokit.issues.createComment()`
