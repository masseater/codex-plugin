#!/usr/bin/env bun
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";

using logger = HookLogger.fromFile(import.meta.filename);

const hook = defineHook({
  trigger: {
    PreToolUse: {
      ExitPlanMode: true,
    },
  },
  run: wrapRun(logger, (context) => {
    const toolInput = context.input.tool_input as Record<string, unknown>;
    const filePath = typeof toolInput?.file_path === "string" ? toolInput.file_path : null;

    logger.debug(`ExitPlanMode detected, file_path: ${filePath}`);

    // Only suggest for plan files
    if (!filePath || !filePath.includes(".agents/plans/")) {
      logger.debug("Not a plan file, skipping");
      return context.success({});
    }

    logger.info(`Suggesting plan-enhancer for: ${filePath}`);

    return context.json({
      event: "PreToolUse" as const,
      output: {
        hookSpecificOutput: {
          hookEventName: "PreToolUse" as const,
          additionalContext:
            "💡 計画ファイルを完成させる前に、`plan-enhancer` スキルを参照して計画を改善することをお勧めします。",
        },
        suppressOutput: true,
      },
    });
  }),
});

if (import.meta.main) {
  await runHook(hook);
}
