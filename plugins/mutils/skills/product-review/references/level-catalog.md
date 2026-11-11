# レベルカタログ

レビュー次元の全体系。各レベルにユニーク ID と blast radius タグを付与する。

目次:

- Blast radius スケール
- デフォルトスコープ（A-K）
  - A コード構造 / B 配置・組織 / C レイヤー設計 / D 横断的関心事 / E サービス設計 / F 制約ハーネス
  - G フィードバックループ / H 品質ゲート / I ビルド・インフラ / J ドキュメント / K プロダクト設計
- released モード専用（L）
- 横断パターン

Blast radius スケール:

- `local` — 単一ファイル、ファイル間影響なし
- `module` — パッケージ/モジュール境界、限定的な影響
- `architecture` — モジュール/レイヤー横断、構造的変更
- `delivery` — ビルド/CI/デプロイパイプラインに影響
- `product` — ドメインモデル、API 契約、データスキーマ
- `migration` — リリース済み製品、後方互換性が必要

## デフォルトスコープ（A-K）

### A. コード構造

- `CS-1` **式・変数・命名** `blast: local`
  - マジックナンバー除去、Rename、Extract Variable、型厳密化
- `CS-2` **関数・クラス構造** `blast: local`
  - Extract Method、Parameter Object、SRP、継承→コンポジション

### B. 配置・組織

- `OG-1` **ファイル構成** `blast: local`
  - 1 ファイル 1 責務、co-location、ファイル分割/統合
- `OG-2` **パッケージ内凝集** `blast: module`
  - public API 整理、internal 分離、barrel export 管理
- `OG-3` **パッケージ間依存** `blast: module`
  - 依存方向矯正、循環依存解消、共通処理抽出

### C. レイヤー設計

- `LY-1` **レイヤー構成** `blast: architecture`
  - 何層にすべきか、各層の役割、ドメインへの適合性
- `LY-2` **依存方向** `blast: architecture`
  - プレゼン→ドメイン→インフラの一方向化
- `LY-3` **責務配置** `blast: architecture`
  - ドメインロジックが正しい層にあるか、境界を超えた漏れがないか
- `LY-4` **境界の明示性** `blast: architecture`
  - 具象依存→インターフェース分離、依存性注入
- `LY-5` **レイヤー間通信** `blast: architecture`
  - DTO/ドメインオブジェクトの分離、マッピング設計

### D. 横断的関心事

- `CC-1` **エラーハンドリング** `blast: architecture`
  - エラー型体系、伝播戦略、エラー境界、リカバリ方針
- `CC-2` **バリデーション** `blast: architecture`
  - 入力検証、スキーマ検証、ドメイン不変条件の検証、検証の配置場所
- `CC-3` **ログ・オブザーバビリティ** `blast: architecture`
  - 構造化ログ、メトリクス、トレーシング、ヘルスチェック
- `CC-4` **認証・認可** `blast: architecture`
  - 認証パターン、権限モデル、セッション管理
- `CC-5` **セキュリティ** `blast: architecture`
  - CSRF、XSS 防御、レートリミット、secret 管理
- `CC-6` **キャッシュ戦略** `blast: architecture`
  - キャッシュ層の設計、無効化戦略、TTL 管理
- `CC-7` **国際化** `blast: architecture`
  - i18n キー管理、翻訳ワークフロー、ロケール処理の統一
- `CC-8` **アクセシビリティ** `blast: architecture`
  - ARIA、キーボード操作、色コントラスト、スクリーンリーダー対応
- `CC-9` **パフォーマンス** `blast: architecture`
  - レンダリング速度、バンドルサイズ、API レスポンスタイム、メモリ使用量
  - パフォーマンスバジェットが定義されているか（Lighthouse スコア、バンドルサイズ上限、API レイテンシ SLO）
  - パフォーマンス劣化を CI で検出する仕組みがあるか（バンドル分析、Lighthouse CI 等）
  - N+1 クエリ、不要な再レンダリング、未最適化アセットなどの既知パターンの検出
- `CC-10` **UX 品質** `blast: architecture`
  - ユーザーフロー、エラー表示、ローディング状態、空状態、レスポンシブ対応
  - エラー発生時にユーザーが次に何をすべきかが明示されているか
  - 非同期操作のフィードバック（ローディング、成功、失敗）が統一されているか
  - エッジケース（空リスト、長文、オフライン）のハンドリングが網羅されているか

### E. サービス設計

- `SV-1` **サービス境界** `blast: architecture`
  - サービス分割/統合（段階的移行パターンはここには含めない。L セクションに配置）

### F. 制約ハーネス（生成前に解空間を狭める）

- `CH-1` **規約の機械的強制** `blast: delivery`
  - ドキュメントだけのルール vs lint/型/hook で error 強制されているルールの比率
  - AGENTS.md や CLAUDE.md にあるだけで機械的に強制されていないルールは、いずれ破られる
- `CH-2` **エラーメッセージの修正指示性** `blast: delivery`
  - "violation detected" vs "`logger.info({event, ...data})` を `console.log` の代わりに使え"
  - AI は修正方法が書かれていれば自律修正する。書かれていなければ抑制するか無視する
- `CH-3` **正規例・生成器・自動修正** `blast: delivery`
  - scaffold/generator/canonical example/codemod のカバレッジ
  - AI は例があれば従う。なければ発明する
- `CH-4` **エージェント実行コンテキスト** `blast: delivery`
  - CLAUDE.md/AGENTS.md がコードベースの実態と一致しているか、暗黙知が文書化されているか
- `CH-5` **Agent work envelope** `blast: module`
  - コンテキストウィンドウへの収容性（ファイル行数、依存の深さ、1 タスクで触るファイル数）
  - コンテキストロードパス、必要ツール数、resume 可能性
- `CH-6` **並列変更の安全性** `blast: architecture`
  - worktree 並列実行可能な境界設計、1 タスクの blast radius
  - 複数の AI セッションが異なるモジュールを同時に変更してマージしても壊れないか
- `CH-7` **仕様の Single Source of Truth 管理** `blast: architecture`
  - 仕様（型定義、スキーマ、API 契約、設定）の正規ソースが 1 箇所に定まっているか
  - 同じ情報が複数箇所に手書きで重複していないか（手書きの重複はいずれ乖離する）
  - 仕様は人間が読んで評価可能な単位で管理されているか
    - 人間が「この仕様は正しいか」と判断できるフォーマット（Markdown、YAML、JSON Schema 等）で書かれているか
    - 仕様とコードが混在せず、仕様だけを取り出してレビューできるか
  - 到達点: 仕様とコードの双方向の自動同期が確立されていること
    - 仕様を変更したら、それに基づいたコード（型定義、バリデーション、設定）が自動生成・更新される
    - コードを変更したら、その変更は人間が読める形式の仕様ドキュメントに自動反映される
    - 仕様は一定の形式（Markdown、YAML、JSON Schema 等）に則って書かれ、人間がレビュー可能
  - NG なのは「仕様が存在しない」「仕様はあるが手動同期でコードと乖離している」「コードだけあって仕様が読めない」状態
  - SSoT の変更は下流の全成果物に自動的に伝播するか、手動同期を要する箇所は残っていないか
- `CH-8` **AI 自律デバッグ環境** `blast: delivery`
  - AI エージェントは、デバッグで使う環境・認証・ツールへ自力でアクセスできるか
  - 例:
    - Preview/staging 環境への認証バイパストークン（Vercel の protection bypass token 等）が環境変数として利用可能か
    - ログ・メトリクスの参照に必要な認証情報（Grafana, Datadog 等）が AI セッションから到達可能か
    - ブラウザ操作（agent-browser）で preview URL にアクセスして動作確認できるか
    - DB のリードレプリカやテスト環境への接続情報が利用可能か
  - AI が「動作確認するには人間にログインしてもらう必要がある」で止まる箇所が残っていないか
  - デバッグに必要な情報が AI のコンテキストに載る形式で取得可能か（構造化ログ、JSON API）
- `CH-9` **Friction Log（辛さの継続記録）** `blast: delivery`
  - 開発中に感じた摩擦・苦痛・回り道を都度記録する仕組みがあるか
  - リファクタリング時に「何がどれだけ辛いか」のデータとして参照し、優先順位付けの根拠にする
  - 記録のタイミング: 問題が起きた瞬間に記録する（後からまとめて書くと忘れる）
  - 記録の形式: ファイルパス + 何が辛かったか + 頻度（初回 / 繰り返し） の 3 項目で十分
  - 記録の蓄積先: `.local-agents/friction-log.md` や GitHub Issue のラベル等、チームで統一された 1 箇所
  - AI セッションでも friction を検出したら自動追記する hook / 習慣があるか
  - 蓄積された friction log が product-review スキャン時に優先順位フレームワークの `feature_friction` 係数の実測値として使える
- `CH-10` **自動生成による制約の実体化** `blast: delivery`
  - SSoT から設定ファイル・型定義・バリデーションコード・ドキュメントを積極的に自動生成しているか
  - 生成された成果物はデフォルトで変更禁止（immutable）とし、手動編集を検出してブロックする仕組みがあるか
  - 自動生成の原則:
    - 生成物にはヘッダコメント（`AUTO-GENERATED — DO NOT EDIT`）を付与する
    - 生成物の手動編集を pre-commit hook または CI で検出・ブロックする
    - 一部の成果物に限り、明示的なオーバーライドセクション（`USER-EDITABLE` マーカーで囲んだ領域）を設けて変更を許可する
    - オーバーライドセクション外への手動編集は再生成時に消失することを警告する
  - AI は生成物を「既にそこにあるコード」と見なして自由に編集しようとする。immutable マーカー + hook でこれを構造的に防ぐ

### G. フィードバックループ（生成中に自己修正を可能にする）

- `FL-1` **振る舞い固定ハーネス** `blast: module`
  - characterization test / golden master / contract test / E2E smoke のカバレッジ
  - これらがなければリファクタリングの振る舞い保存を検証できない
- `FL-2` **自動検証の速度と網羅性** `blast: delivery`
  - テスト・型チェック・lint が AI の反復に十分な速度で pass/fail を返せるか
  - 検証がなければ AI は「完了に見える」で止まる
- `FL-3` **型システムの表現力** `blast: module`
  - `any` の残存量、strict mode、型ガードの充実度
  - 型が緩いとエラー検出がランタイムまで遅延する
- `FL-4` **変更影響の可視性** `blast: architecture`
  - 変更の波及効果を型/テスト/lint が即座に検出できるか

### H. 品質ゲート（生成後にマージを阻止する）

- `QG-1` **CI ゲート** `blast: delivery`
  - カバレッジ閾値、ビルド成果物検証、セキュリティスキャン
  - 全て error。warn は存在しないのと同じ
- `QG-2` **アーキテクチャ準拠ゲート** `blast: architecture`
  - 依存方向ルール、ファイル配置ルール、import 制限の機械的検証
  - テストスイートではアーキテクチャ違反を検出できない
- `QG-3` **抑制の禁止** `blast: delivery`
  - eslint-disable / @ts-ignore / skip の新規追加を CI でブロック
  - AI は修正より抑制を選びやすい
- `QG-4` **監査証跡** `blast: delivery`
  - 候補化理由、承認記録、before/after メトリクス、rollback point
  - AI 自律実行のアカウンタビリティに必要

### I. ビルド・インフラ

- `BI-1` **ビルドツール** `blast: delivery`
  - ビルドシステム移行（webpack → vite 等）、バンドル戦略、ESM 化
- `BI-2` **CI/CD** `blast: delivery`
  - パイプライン構成、キャッシュ戦略、デプロイフロー
- `BI-3` **ワークスペース構成** `blast: delivery`
  - monorepo 分割/統合、パッケージ境界、依存管理ツール

### J. ドキュメント

- `DC-1` **プロダクト・API ドキュメント** `blast: product`
  - 人間・外部向けドキュメントの整備（CH-4 の AI 実行コンテキストとは別）
- `DC-2` **ユビキタス言語** `blast: product`
  - 用語統一、命名とドメイン概念の整合

### K. プロダクト設計

- `PD-1` **境界コンテキスト** `blast: product`
  - コンテキスト分割/統合、コンテキストマッピング
- `PD-2` **集約・エンティティ** `blast: product`
  - 集約境界の再設計、値オブジェクト抽出、不変条件の明示化
- `PD-3` **API エンドポイント設計** `blast: product`
  - リソース設計、URL 構造、レスポンス形式
- `PD-4` **データスキーマ設計** `blast: product`
  - テーブル構造、正規化/非正規化、インデックス戦略

## released モード専用（L）

`released` 引数で有効化。既存ユーザーがいる製品の後方互換移行パターンをカバーする。

### L. リリース済み製品の移行

- `RM-1` **API 互換性管理** `blast: migration`
  - Expand-Migrate-Contract、バージョニング、deprecation window
- `RM-2` **データマイグレーション** `blast: migration`
  - スキーマ進化、ETL、dual-write、データ移行計画
- `RM-3` **リリース制御** `blast: migration`
  - feature flag、canary、rollback、SLO 監視
- `RM-4` **段階的置換** `blast: migration`
  - Strangler Fig、Legacy Displacement Patterns、段階的な移行計画

## 横断パターン

実際の改善は複数レベルにまたがることがある。候補を提示する際は該当する全レベル ID をタグ付けする。

例:

- God class 分割: CS-2（クラス分割）+ OG-1（ファイル配置）+ OG-2（パッケージ凝集）+ OG-3（依存方向）+ LY-3（レイヤー責務）
- 認証ミドルウェア統一: CC-4（認証パターン）+ LY-4（境界/DI）+ CH-1（lint ルール強制）
- Monorepo 再構成: BI-3（ワークスペース）+ OG-3（パッケージ間依存）+ CH-6（並列安全性）+ BI-2（CI/CD）
