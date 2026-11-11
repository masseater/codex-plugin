---
name: product-review
description: プロダクト全体を階層的にスキャンして改善候補を出し、ユーザーが承認した候補を実行して候補ごとに commit する。対象はコード構造、アーキテクチャ、横断的関心事、AI ハーネス、インフラ、ドキュメント、プロダクト設計である。
disable-model-invocation: true
argument-hint: "[released] [セクション文字 or レベル ID ...]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(ls *), Bash(find *), Bash(rg *), Bash(git status), Bash(git diff *), Bash(git log *), Bash(git rev-parse *), Bash(git add *), Bash(git commit *), Bash(gh pr list *), Bash(gh pr view *), Bash(bun run check), Bash(bun run typecheck), Bash(bun run test), Bash(bun run lint), Agent
---

# product-review

diff のレビューではなく、プロダクト全体の構造を監査する。候補は個別のコード操作ではなく方針の単位で出し、それぞれにレベル ID と blast radius を付ける。

引数: `$ARGUMENTS`

- 無し: A〜K をスキャンする（pre-release モード）
- `released`: L（リリース済み製品の移行）を加える
- セクション文字（`F G H`）やレベル ID（`CH-1 FL-3`）: 指定したものだけをスキャンする。`released CH-1 FL-3` のように組み合わせられる

レベルの定義と blast radius は [references/level-catalog.md](references/level-catalog.md)、候補を挙げる基準と優先順位は [references/assessment-guide.md](references/assessment-guide.md) にある。

## スキャンの順序

上位で「再設計が要る」と判定した領域は、下位のスキャンから外す。再設計で消える細かな候補を調べる無駄を省くため。

```pseudocode
function product_review(args):
  mode, scope = parse(args)                 // scope: 指定が無ければ A-K、released なら + L

  harness = scan(intersection(scope, [F, G, H]))      // 1. ハーネス
  upper   = scan(intersection(scope, [C, D, E, K]))   // 2. 上位（recommendation と affected_paths 付き）
  redesign_prefixes = normalize(union(c.affected_paths for c in upper if c.recommendation == "redesign"))
  lower_scope = intersection(scope, [A, B, I, J]) + ([L] if mode == "released" and L in scope else [])
  lower   = scan(lower_scope, exclude = redesign_prefixes)  // 3. 中位・下位

  candidates = prioritize(merge(harness + upper + lower))
  present(candidates)                        // 4. 提示してユーザーの選択を待つ
  execute(approved)                          // 5. 承認された候補だけ実行
```

- scope に上位（C/D/E/K）が無ければ、redesign の除外はせずに下位をそのままスキャンする
- ハーネス（F/G/H）を先に診断するのは、ハーネスが弱いままコードを変えるのは危険で、ハーネスの改善の方が欠陥のカテゴリごと防げるため

## サブエージェントへの依頼

スキャンはセクションごとに 1 つのサブエージェントへ並列に任せる（同時に 5 つまで）。依頼文には次を入れる。

```text
対象リポジトリ: <パス>
担当セクション: <セクション>
担当レベルの定義: <level-catalog.md の該当セクションを貼る>
除外する path prefix: <redesign_prefixes。無ければ「なし」>   // 中位・下位のみ

各レベルについて改善候補を方針単位で挙げ、次の形式で返す:
- ID / 方針（1 行）/ blast_radius / 根拠（ファイルパスと行を含む）/ 横断する他のレベル ID
- 上位セクションでは recommendation（"refactor" か "redesign"）と affected_paths（path prefix のリスト。redesign なら必須）も付ける
問題が無いレベルは、求める状態が既に達成されているか前提が当てはまらないなら「該当なし: <理由 1 行>」、調べたが見つからなかったなら「未検出（調査範囲: …）」と書く。
除外 path prefix の配下にしか問題が無いレベルは「除外領域につき判定省略」と書く。候補がゼロでも調べた範囲を報告する。
```

依頼文に「X に集中してよい」「X は該当しない」「コード量が多い箇所に絞る」のような対象を狭める文言を書かない。apps・packages・plugins・scripts・hooks・assets・Markdown のすべてを観点ごとに評価させ、Markdown が主体の plugin も主成果物として扱わせるため。

## 候補の提示

1 つの PR で同時に片付く候補は 1 つにまとめ、関係するレベル ID をすべて書く。根本原因が同じでも修正が別なら分ける。セクションごとにまとめ、各セクション内を優先度順に並べる。

```text
ID:           CH-1
方針:          AGENTS.md の lint ルールのうち 12 件が eslint / tsc / hook で error 化されていない
Blast Radius: delivery
優先度:        高（直近 5 PR で AI 生成コードが同じ違反を繰り返している）
レベル:        CH-1, QG-1
根拠:          AGENTS.md L45-L60 のルールに対応する設定が .eslintrc に無い
```

一覧を出したら、実行する候補の ID をユーザーに返答してもらう。選ばれなかった候補は実行しない。

## 実行

承認された候補は、blast radius の小さい順（local → module → architecture → delivery → product → migration）に、メインエージェントが自分で実行する。変更の責任を 1 か所に保つため、実行はサブエージェントに任せない。

候補ごとに次を行う。

1. `git rev-parse HEAD` で rollback point を控える
2. 変更し、プロジェクトのテスト・型チェック・lint を通す
3. `<ID>: <方針>` のメッセージで commit する
4. 理由・承認・rollback point・変更前後の差分を報告に残す（QG-4 の監査証跡）

最後に、実行した候補と各 commit、実行しなかった候補をまとめて報告する。
