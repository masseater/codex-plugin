---
name: status
description: SDD の各 spec の進み具合と次にやる作業を示し、SDD の流れを説明する。「SDD の進捗を見せて」「次に何をすればいいか教えて」「spec の一覧を見せて」「SDD の使い方を教えて」と聞かれたときに使う。
argument-hint: "[spec 名]"
---

# SDD の状態と次の作業

SDD（Spec-Driven Development）は、仕様書を先に固めてから Phase ごとに実装する進め方である。前半は steering（初回のみ）→ spec init → spec research → spec requirements の順に進める。続けて spec technical → spec clarify → validate spec で仕様を固める。後半は phase plan → Phase ごとに breakdown → implement → validate → archive と進む。

## 手順

1. 状態を取得する。spec 名を渡されたらその spec だけを対象にする

   ```bash
   ${CLAUDE_SKILL_DIR}/scripts/spec-state.ts specs $ARGUMENTS
   ```

   出力は spec ごとの JSON（`status`、調査項目、`unclearCount`、計画済みの Phase、phase ファイルごとの status とタスク数、`next`）。`next.command` が次の作業、`next.reason` がその理由

2. spec ごとに「状態 / Phase の進み具合（完了タスク数 / 全タスク数）/ 次の作業とその理由」を箇条書きで示す
3. `.claude/skills/steering/` がなければ、最初に `/sdd:steering` を勧める
4. SDD の使い方を聞かれたら、上の流れと、各 skill（`/sdd:spec`・`/sdd:phase`・`/sdd:validate`・`/sdd:archive`・`/sdd:autopilot`）の役割を短く説明する

sdd-webapp を登録済みなら、ダッシュボードでも同じ spec を見られる。`mcp__plugin_sdd_sdd-webapp__sdd_webapp_get_status` の結果はファイルとずれていることがある。食い違ったら spec-state.ts の結果を正とし、ずれている Phase を `mcp__plugin_sdd_sdd-webapp__sdd_webapp_set_phase` で直す。
