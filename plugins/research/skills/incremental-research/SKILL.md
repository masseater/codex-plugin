---
name: research:incremental-research
description: 'This skill should be used when the user asks to "research incrementally", "調査計画を作って進める", "multi-step investigation", "調査結果を記録", or wants structured research tracked in a markdown plan.'
argument-hint: "[調査テーマ]"
---

# 構造化調査

調査計画をmarkdownファイルに記載し、順次調べて結果を更新する。

## 実行手順

### 1. 調査テーマの確認

- IF: `$ARGUMENTS` が空 AND 対話可能; THEN MUST: ユーザーに調査テーマを聞く
- IF: `$ARGUMENTS` が空 AND 非対話・自動実行でユーザーに聞けない; THEN MUST: 「テーマ未指定のため実行不可」と報告して停止する
  - MUST NOT: テーマを捏造する / 文脈から勝手に推測する（代わりに上記の通り停止して報告する）

### 2. 調査ディレクトリと計画ファイルの作成

`[テーマ名]` は調査テーマを **英小文字 kebab-case の短いスラグ**に正規化する（日本語や長文テーマはこのルールで短い英語スラグに変換）。例: 「GitHub Actions の concurrency 挙動」→ `github-actions-concurrency`。

```
.agents/research-[テーマ名]/
└── plan.md
```

### 3. plan.md の初期構造

```markdown
# [調査テーマ]

## 目的

[調査の目的を記載]

## 調査項目

### 1. [調査項目1]

**状態**: 未調査
**結果**:

---

### 2. [調査項目2]

**状態**: 未調査
**結果**:

---

（必要に応じて項目を追加）

## 結論

（調査完了後に記載）
```

### 4. 調査の実行

各調査項目について MUST: 以下を順に実施する:

1. **状態** を「調査中」に更新
2. 調査を実行（WebSearch, WebFetch, Bash など）
3. **結果** に調査内容を記載
4. **状態** を「完了」に更新
5. plan.md を保存

- IF: 調査中に新たな調査項目が発生した; THEN MUST: plan.md に追加する。追加した新項目も「未調査→調査中→完了」のライフサイクルに従わせる
- IF: 複数項目を並行して調査する; THEN MUST: 着手する全項目を先に「調査中」に更新してから実行する

状態遷移そのものは厳密な逐次保存を要求しない（最終成果物として全項目が「完了」になり、結果と結論が揃っていればよい）。

### 5. 結論の記載

全ての調査項目が完了したら:

1. 調査結果を総合的に分析
2. 結論セクションに最終的な判断を記載
3. 必要に応じて根拠を箇条書きで列挙

## 注意事項

- MUST: 各調査項目の結果は具体的に記載する（「確認した」ではなく、何を確認してどうだったかを書く）
- SHOULD: 調査途中でも定期的に plan.md を保存する
- MUST: 結論は根拠に基づいて明確に記載する
