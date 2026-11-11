# 評価ガイド

候補を挙げるか、どう優先するかの判断基準。

## 経済的な目的

改善はコードの美しさではなく、機能追加やトラブルシュートを速くするという経済的な価値のために行う。各候補には「どんな価値を生むか」を書けるものだけを挙げる。AI がコードを書く前提では「AI の生成結果が決定的に正しくなるか」も価値に含む。ハーネス（F-H）の改善は欠陥のカテゴリごと防ぐので、効果が大きい。

## コード構造（CS / OG / LY）を改善する時機

- 挙げる: 新機能を足す前に構造が邪魔をしている、同じ重複が 3 回目に現れた、バグの温床になっている、理解しにくく頻繁に読まれる
- 挙げない: 動いていて今後触る予定がない、段階的に直すより作り直した方が安い
- リファクタかリライトかは、次の 5 問のうち 3 つ以上が「はい」ならリライトか Strangler Fig による段階的置換を検討する
  1. テストが無く、characterization test も現実的でない
  2. システムを理解しているメンバーがいない
  3. 段階的に改善する道筋が無い
  4. アーキテクチャが要件と根本的に合っていない
  5. 規制やセキュリティの期限で段階的な進め方ができない

## ハーネス（F-H）を改善する時機

ほぼ常に価値がある。特に、制約があれば防げた AI 生成コードの繰り返しパターンを優先する。直近の AI 生成 PR で繰り返されている負債パターンを探し、それを防ぐ制約を、修正方法を書いたエラーメッセージ付きの lint ルールや hook にして、CI で失敗させる。

仕様の Single Source of Truth と自動生成（CH-7、CH-10）は、他の制約の土台になる。手動同期が残る限り、lint ルールを増やしても仕様とコードは乖離する。

## 横断的関心事（CC）を改善する時機

同じ関心事がコードベース内で一貫せずに扱われているとき（エラーハンドリングのパターンが複数ある、ログの形式がモジュールごとに違う、バリデーションの場所がレイヤーごとに違う、認証チェックが重複している）。

## AI 固有のリスク

候補の根拠や実行時の注意として使う。

- 局所最適化: 見ているファイルだけを最適化し、モジュール間の不変条件を壊す
- 存在しない import・API・関数シグネチャを作る
- lint が失敗すると、原因を直さずに抑制コメントを足す
- 構文を保ったまま業務ルール（ドメインの不変条件）を壊す

## 優先順位

コードの古さやスメルの数ではなく、機能開発をどれだけ妨げているかで並べる。friction log（CH-9）があれば、該当するエントリ数を `feature_friction` の実測値に使う。無ければ高 / 中 / 低の定性判断で代える。

```pseudocode
function prioritize(candidates):
  friction_log = load_friction_log()  // CH-9 の記録。無ければ定性判断
  for candidate in candidates:
    candidate.priority = weighted_sum(
      feature_friction  * 0.4,  // 機能開発をどれだけ妨げているか
      defect_frequency  * 0.3,  // どれだけ頻繁にバグを生むか
      ai_failure_rate   * 0.2,  // AI がどれだけ間違えるか
      blast_radius_cost * 0.1   // 変更が失敗したときのコスト
    )
  return candidates.sort_by(priority, descending)
```

## 出典

- Martin Fowler, _Refactoring_ 第 2 版（2018）
- [Fowler: Parallel Change](https://martinfowler.com/bliki/ParallelChange.html)
- [Fowler: Patterns of Legacy Displacement](https://martinfowler.com/articles/patterns-legacy-displacement/)
- [Augment Code: Harness Engineering for AI Coding Agents](https://www.augmentcode.com/guides/harness-engineering-ai-coding-agents)
- [Anthropic: Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
