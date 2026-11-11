---
name: swarm
disable-model-invocation: true
description: タスクに合わせて Agent Teams のチームを role ベースで設計し、承認を得て起動・運用する。`design-only` を渡すと起動せず設計だけ行う。
argument-hint: "[design-only] [タスクの説明]"
---

# Agent Teams でタスクを進める

ユーザーが Agent Teams を選んだ前提で、チームを設計して起動する。起動の段階で Agent Teams が使えない（チーム作成のツールが無い）なら、公式ドキュメント（<https://code.claude.com/docs/en/agent-teams>）の有効化手順をユーザーに案内して止める。

引数: `$ARGUMENTS`（先頭が `design-only` なら手順 4 で止める）

## 手順

1. タスクを把握する。成果物、並列に進められる部分、同じファイルを触る部分を整理する。分からない点があれば `AskUserQuestion` で聞く
2. role を設計する。成果物ではなく専門性・視点で分け、各 role が全成果物を横断して見るようにする。人数は 3〜5 人。role テンプレートとアンチパターンは [references/team-design.md](references/team-design.md) を読む
3. タスクリストを TaskCreate で作る。1 人あたり 5〜6 タスクを目安に、依存は `blockedBy` で明示し、同じファイルを 2 人が編集するタスクを作らない
4. チーム案（各メンバーの名前・role・責任範囲）とタスクリストを提示し、承認を 1 回もらう。`design-only` ならここで終える
5. チームを起動する。teammate はリードの会話履歴を引き継がないので、spawn prompt にファイルパス・設計判断・制約・規約をすべて書く

   ```text
   Create an agent team for <タスク>. Spawn teammates:
   - <name-1> focused on <role>: <具体的な指示と背景>
   - <name-2> focused on <role>: <具体的な指示と背景>
   ```

6. 運用する。連絡は特定の teammate へのダイレクトメッセージを基本にし、全員への broadcast は人数分のコストがかかるので控える。teammate 同士の結論の食い違いを拾って統合し、方向がずれた teammate には直接修正を伝える。完了したら各 teammate を shut down し、リードがチームを片付ける

## 制約

- 同じファイルを 2 人の teammate が編集すると上書きが起きるので、編集するファイルは teammate ごとに分ける
- teammate は自分のチームを作れない（ネストしたチームは不可）
- Agent Teams は実験的機能で、制限（resume 後の復帰、1 セッションあたりのチーム数、権限の引き継ぎなど）は版によって変わる。運用中に挙動が想定と違ったら https://code.claude.com/docs/en/agent-teams の Limitations を確かめる
