---
name: init-project
description: devkit の規約に沿って新しい TypeScript Web プロジェクトを作成するか、既存プロジェクトに不足しているツールと設定を補う。「新しいプロジェクトを立ち上げたい」「このプロジェクトに devkit の構成を入れて」と頼まれたときに使う。
---

# init-project

技術選定は `devkit:standards` skill の reference（`../standards/references`）に従う。ここでは手順だけを書く。

## 分岐

```text
if cwd に package.json が無い: 新規作成
else: 既存プロジェクトの補完
```

## 新規作成

1. プロジェクト名をユーザーに聞く
2. 次のコマンドで雛形を作る。`--yes` は指定しなかった選択肢を既定値で埋め、対話の質問で Bash が止まらないようにする

   ```bash
   pnpm create next-app@latest <name> --ts --app --tailwind --src-dir --use-pnpm --eslint --import-alias "@/*" --yes
   ```

3. pnpm workspace と Turborepo を設定する（`../standards/references/ecosystem.md`）
4. 品質ツールを入れる（`../standards/references/quality-automation.md`）
5. backend の依存を入れる（`../standards/references/backend.md`）
6. AGENTS.md を整える（create-next-app は AGENTS.md と CLAUDE.md を生成する）。context plugin があれば `context:context-refactor` の配置基準に合わせる

## 既存プロジェクトの補完

1. AGENTS.md / CLAUDE.md と `package.json` から現在の技術構成を読む
2. `../standards/references/quality-automation.md` のツールが入っているか確かめ、足りないものを入れる
3. 設定ファイルを作成・更新する。既存ファイルを上書きする前に差分を見せて確認を取る

## DEVKIT_ENFORCE_TOOLS

セットアップ後、pnpm と tsgo を使うプロジェクトでは環境変数 `DEVKIT_ENFORCE_TOOLS=1` を案内する。設定すると devkit の hook が `npx` / `npm` / `tsc` を止め、`pnpx` / `pnpm` / `tsgo` へ誘導する。

hook は Claude Code を起動したシェルの環境変数を読む。`.envrc` に `export DEVKIT_ENFORCE_TOOLS=1` を書く場合は、direnv で読み込まれたシェルから Claude Code を起動する必要がある。
