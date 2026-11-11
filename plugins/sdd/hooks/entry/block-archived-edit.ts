#!/usr/bin/env bun
/**
 * specs/_archived/ ディレクトリ内のファイル編集を禁止するフック
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
    const filePath = context.input.tool_input.file_path;

    // specs/_archived/ パスを含むかチェック
    if (!filePath.includes("specs/_archived/")) {
      return context.success({});
    }

    return context.json({
      event: "PreToolUse" as const,
      output: {
        hookSpecificOutput: {
          hookEventName: "PreToolUse" as const,
          permissionDecision: "deny" as const,
          permissionDecisionReason: [
            "specs/_archived/ 内のファイルはアーカイブ済みのため編集禁止です。",
            "",
            "WHY: Archived specs must not be modified to preserve the audit trail of completed work.",
            "FIX: To modify archived content, first unarchive with `/sdd:archive`, or create a new spec instead.",
          ].join("\n"),
        },
      },
    });
  }),
});

if (import.meta.main) {
  await runHook(hook);
}
