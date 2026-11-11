#!/usr/bin/env bun
import { lstatSync } from "node:fs";
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
/**
 * CLAUDE.md を編集しようとした際に AGENTS.md を編集するよう指示するフック
 * シンボリックリンクの場合はスキップ（既に AGENTS.md へのリンクになっている）
 */
import { defineHook, runHook } from "cc-hooks-ts";

using logger = HookLogger.fromFile(import.meta.filename);

export function isRegularFile(path: string): boolean {
  try {
    return lstatSync(path).isFile();
  } catch {
    return false;
  }
}

const hook = defineHook({
  trigger: {
    PreToolUse: {
      Write: true,
      Edit: true,
    },
  },
  run: wrapRun(logger, (context) => {
    const toolName = context.input.tool_name;
    const filePath = context.input.tool_input.file_path;
    logger.debug(`Hook triggered: tool=${toolName}, file=${filePath}`);

    const fileName = filePath.split("/").pop();
    if (fileName !== "CLAUDE.md") {
      logger.debug(`Allowing edit: ${fileName} is not CLAUDE.md`);
      return context.success({});
    }

    if (!isRegularFile(filePath)) {
      logger.debug(`Allowing edit: ${filePath} is a symlink or does not exist`);
      return context.success({});
    }

    logger.warn(`Denying ${toolName} on CLAUDE.md: ${filePath}`);
    return context.json({
      event: "PreToolUse" as const,
      output: {
        hookSpecificOutput: {
          hookEventName: "PreToolUse" as const,
          permissionDecision: "deny" as const,
          permissionDecisionReason:
            "Direct edits to CLAUDE.md are not allowed. Create AGENTS.md and make CLAUDE.md a symlink to it.",
        },
      },
    });
  }),
});

/* v8 ignore next 3 */
if (import.meta.main) {
  await runHook(hook);
}
