---
name: standards-audit
description: プロジェクト（monorepo なら各 workspace）を devkit の規約と照合し、違反と未導入の推奨事項を一覧で報告する。読み取り専用。「規約チェックして」「devkit の規約に沿っているか監査して」「この CLI ツールが規約どおりか見て」と頼まれたときに使う。
argument-hint: "[path] [--reference <name>]"
---

# standards-audit

## 引数

- `path`: 監査するプロジェクトのルート、または対象ディレクトリ。省略時は cwd
- `--reference <name>`: 照合する reference を 1 つに絞る（例: `--reference cli` で CLI ツールの規約だけを見る）

## 手順

1. 機械チェックを実行する。決定的に判定できる項目はこのスクリプトが担う

   ```bash
   bun ${CLAUDE_SKILL_DIR}/scripts/audit.ts <path>
   ```

   出力の `Type:` と見出しから、スコープ（単一プロジェクト、または `(root)` と各 workspace）と種別を読む。種別は依存から判定される: `next` → web、`hono` → backend、`citty` → cli。違反があると exit 1 になるが、失敗ではない

2. スコープごとに照合する reference を決める。reference は `../standards/references/<name>.md` にある

   ```text
   if --reference が指定された: その reference だけ
   else:
     (root) スコープ: ecosystem, quality-automation, documentation, ai-harness, parallel-dev
     すべてのスコープ: coding-standards, test, observability
     種別に応じて: web → web, backend → backend, cli → cli
   ```

3. 判断が要る照合をする。委譲の単位は「1 スコープ × そのスコープの全 reference」にし、サブエージェントの総数は 8 体までにする。小さい照合まで委譲すると、起動と受け渡しのコストが照合そのものより大きくなるため

   ```text
   if スコープが 1 つで、照合する reference が 3 つ以下（--reference 指定時など）:
     このセッションで ../../agents/standards-auditor.md の手順と出力形式に従って照合する
   else:
     groups = スコープを最大 8 グループに分ける（スコープが 8 以下なら 1 スコープ 1 グループ、超えたら隣り合う workspace をまとめる）
     グループごとに devkit:standards-auditor を 1 体起動する（同時に起動するのは 4 体まで）
   ```

   サブエージェントに渡すもの:
   - グループ内の各スコープのラベル・絶対パス・種別と、そのスコープで照合する reference の名前
   - `devkit:standards` SKILL.md の Philosophy 節
   - 照合する reference ファイルの全文（グループ内で重複するものは 1 回だけ）
   - 手順 1 で同じスコープ・reference について出た指摘（重複して報告させないため）

   サブエージェントがタイムアウトした、または JSON 配列を返さなかった場合は、報告の Warnings に `<scope>: <理由>` を載せる

4. 手順 1 と 3 の指摘をまとめて報告する
   - 同じ `file` と `line` の指摘は 1 つにまとめる
   - スコープ順（`(root)` が先、あとは名前順）、その中でファイルパス順・行番号順に並べる
   - 各行: `- [<severity> / <confidence>] [<rule>] \`file:line\` — message`（場所が無いものは `(project-level)`）
   - 末尾に件数の要約。指摘が無ければ「All checks passed.」とだけ書く

ファイルは変更しない。修正はユーザーが別に頼んだときに行う。

## 機械チェックの追加

`${CLAUDE_SKILL_DIR}/scripts/checks/` の下に `<name>/index.ts` を作る。`meta: CheckMeta` と `run(ctx: ProjectContext): Promise<Finding[]>` を export すると `audit.ts` が自動で読み込む。

## Stop hook

`DEVKIT_AUDIT_ON_STOP=1` のとき、SessionStart で違反の基準値を記録し、Stop でこのセッション中に増えた違反だけを 1 回通知する。全件は `.claude/hooks/quality-check-log/standards-audit.log` に書く。
