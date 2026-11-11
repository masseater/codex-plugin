# SDD Workflow Diagram

SDDワークフロー全体の正準（single source of truth）ドキュメント。他ファイルからはこのファイルを参照すること。

```mermaid
flowchart TB
    subgraph Step1["Step 1: プロジェクト方針定義（初回のみ）"]
        S1["永続的メモリを作成<br/>📖 /sdd:steering"]
    end
    S1 -->|作成| A_steering[(.claude/skills/steering/)]

    subgraph Step2["Step 2: タスク初期化"]
        S2["仕様書の骨格を作成<br/>🤖 sdd-webapp登録<br/>📖 /sdd:spec init"]
    end
    S2 -->|作成| A_overview[(specs/spec/overview.md)]

    subgraph Step3["Step 3: 技術調査"]
        S3["調査項目を実施<br/>🔁 項目ごとに繰り返し<br/>📖 /sdd:spec research"]
    end
    S3 -->|作成| A_research[(specs/research/*.md)]
    S3 -->|更新: 調査状態| A_overview

    subgraph Step4["Step 4: 要件・技術詳細の定義"]
        S4_1["機能要件・非機能要件を定義<br/>📖 /sdd:spec requirements"]
        S4_2["技術詳細を設計<br/>📖 /sdd:spec technical"]
        S4_1 --> S4_2
    end
    S4_1 -->|作成| A_spec[(specs/spec/specification.md)]
    S4_2 -->|作成| A_tech[(specs/spec/technical-details.md)]

    subgraph Step5["Step 5: 不明点の明確化"]
        S5["不明点をユーザーに質問<br/>📖 /sdd:spec clarify"]
    end
    S5 -->|更新: 不明マーク解消| A_spec
    S5 -->|更新: 不明マーク解消| A_tech

    subgraph Step6["Step 6: Phase構成決定"]
        S6_0["仕様書を検証<br/>📖 /sdd:validate spec"]
        S6["Phase構成を決定<br/>📖 /sdd:phase plan"]
        S6_0 --> S6
    end
    S6 -->|更新: Phase構成| A_overview

    subgraph Step7["Step 7: Phaseサイクル（🔁 Phaseごとに繰り返し）"]
        S7_1["詳細計画書を作成<br/>📖 /sdd:phase breakdown"]
        S7_2["コード・テストを実装<br/>📖 /sdd:phase implement"]
        S7_3["検証を実施<br/>📖 /sdd:validate phase"]
        S7_1 --> S7_2 --> S7_3
        S7_3 -->|問題あり| S7_2
    end
    S7_1 -->|作成| A_phase[(specs/spec/phases/phase{N}-{name}.md)]
    S7_2 -->|作成・更新| A_code[(ソースコード)]
    S7_2 -->|更新: タスク状態・status| A_phase

    subgraph Done["完了"]
        Archive["タスクをアーカイブ<br/>🤖 編集をブロック<br/>📖 /sdd:archive"]
    end
    Archive -->|移動| A_archived[(specs/_archived/spec/)]

    Step1 --> Step2 --> Step3 --> Step4 --> Step5 --> Step6 --> Step7
    S6 -->|要件不足| S4_1
    S6 -->|調査不足| S3
    S7_3 -->|問題なし・全Phase完了| Done
```

凡例: 🔁 繰り返し / 🤖 自動制御 / 📖 スキル。

## 任意のタイミングで使う skill

- `/sdd:status [spec]` — spec ごとの進み具合と次の作業（`spec-state.ts` がファイルから判定する）
- `/sdd:phase sync <spec>` — 実装の進み具合を phase ファイルへ反映する（中断前など）
- `/sdd:phase insert <spec> [位置]` — 未着手の Phase の前か末尾に Phase を挿入する
- `/sdd:validate spec <spec>` — spec 文書の矛盾・ステアリング準拠・実現可能性を検証する
- `/sdd:autopilot [spec]` — Step 2〜7 を自動で進める（明示的に呼んだときだけ動く）

## 状態の持ち方

- spec 全体: overview.md の frontmatter `status:`（`/sdd:archive` が completed / rejected を対象にする）
- Phase: `phases/phase{N}-{name}.md` の frontmatter `status:`（hook が記載を必須にしている）
- タスク: phase ファイルの「タスク」節のチェックボックス
- 調査項目: overview.md の「調査項目」節のチェックボックス
- sdd-webapp のダッシュボードは独自のストアを読むので、skill が status を変えたときに `mcp__plugin_sdd_sdd-webapp__sdd_webapp_set_phase` で反映する

## 生成されるディレクトリ構造

詳細: [directory-structure.md](directory-structure.md)
