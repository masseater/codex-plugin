#!/usr/bin/env bun
/**
 * Phase計画書にステータス表記を必須にするフック
 * 対象: specs/{task}/tasks/phase*.md
 */
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";

using logger = HookLogger.fromFile(import.meta.filename);

const hook = defineHook({
  trigger: {
    PreToolUse: {
      Write: true,
      Edit: true,
    },
  },
  run: wrapRun(logger, (context) => {
    const filePath: string = context.input.tool_input.file_path;

    // Phase計画書のみ対象（specs/**/tasks/phase*.md）
    if (!filePath.match(/specs\/[^/]+\/tasks\/phase\d+-[^/]+\.md$/)) {
      return context.success({});
    }

    // Write の場合は content、Edit の場合は new_string を取得
    const toolName = context.input.tool_name;
    let content: string;

    if (toolName === "Write") {
      content = context.input.tool_input.content;
    } else {
      // Edit の場合、new_string を確認
      const newString: string = context.input.tool_input.new_string;
      const oldString: string = context.input.tool_input.old_string;

      // ステータス行を削除しようとしている場合はブロック
      if (hasStatusNotation(oldString) && !hasStatusNotation(newString)) {
        return context.json({
          event: "PreToolUse" as const,
          output: {
            hookSpecificOutput: {
              hookEventName: "PreToolUse" as const,
              permissionDecision: "deny" as const,
              permissionDecisionReason:
                "Phase計画書からステータス表記を削除することはできません。\n\n" +
                "**WHY:** ステータス表記はSDDワークフローの進捗追跡に必須です。削除すると `sdd:status` や sdd-webapp が正しく動作せず、チーム全体の進捗可視性が失われます。\n" +
                "**FIX:** YAML Frontmatter (`status: in_progress`) または Markdown (`**状態**: 進行中`) 形式でステータスを維持してください。",
            },
          },
        });
      }

      // Edit でステータスが元々なく、追加もされていない場合は許可
      // (既存ファイルの部分編集で、ステータス行以外を編集している場合)
      return context.success({});
    }

    // Write の場合、ステータス表記があるかチェック
    if (!hasStatusNotation(content)) {
      return context.json({
        event: "PreToolUse" as const,
        output: {
          hookSpecificOutput: {
            hookEventName: "PreToolUse" as const,
            permissionDecision: "deny" as const,
            permissionDecisionReason:
              "Phase計画書にはステータス表記が必須です。\n\n" +
              "**WHY:** ステータス表記はSDDワークフローの進捗追跡に必須です。未記載だと `sdd:status` や sdd-webapp がPhaseの状態を把握できず、ワークフロー全体の進行管理が破綻します。\n\n" +
              "**FIX:** 以下のいずれかの形式でステータスを追加してください:\n\n" +
              "1. YAML Frontmatter（推奨）:\n" +
              "```\n" +
              "---\n" +
              "status: not_started  # not_started | in_progress | completed\n" +
              "---\n" +
              "```\n\n" +
              "2. Markdown本文:\n" +
              "```\n" +
              "**状態**: 未着手  # 未着手 | 進行中 | 完了\n" +
              "```",
          },
        },
      });
    }

    return context.success({});
  }),
});

/**
 * ステータス表記があるかチェック
 */
function hasStatusNotation(content: string): boolean {
  // YAML Frontmatter の status:
  if (/^---\n[\s\S]*?^status:\s*.+$/m.test(content)) {
    return true;
  }

  // Markdown の **状態**:
  if (/\*\*状態\*\*:\s*.+/.test(content)) {
    return true;
  }

  // 旧形式
  if (/^status:\s*(completed|in_progress|not_started)$/m.test(content)) {
    return true;
  }
  if (/^ステータス:\s*(完了|進行中|未着手)$/m.test(content)) {
    return true;
  }

  return false;
}

if (import.meta.main) {
  await runHook(hook);
}
