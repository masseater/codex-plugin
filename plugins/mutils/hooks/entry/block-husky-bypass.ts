#!/usr/bin/env bun
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";

using logger = HookLogger.fromFile(import.meta.filename);

const HUSKY_BYPASS_PATTERN = /\bHUSKY\s*=\s*0\b/;

const hook = defineHook({
  trigger: {
    PreToolUse: {
      Bash: true,
    },
  },
  run: wrapRun(logger, (context) => {
    const input = context.input;
    if (!input) {
      return context.success({});
    }

    const command = input.tool_input.command;
    if (!command || !HUSKY_BYPASS_PATTERN.test(command)) {
      return context.success({});
    }

    const reason = `HUSKY=0 is not allowed. Git hooks (husky) must not be bypassed.
FIX: Remove HUSKY=0 from the command and let git hooks run normally.`;

    logger.warn("Blocked HUSKY=0 bypass attempt", { command });

    return context.json({
      event: "PreToolUse" as const,
      output: {
        hookSpecificOutput: {
          hookEventName: "PreToolUse" as const,
          permissionDecision: "deny" as const,
          permissionDecisionReason: reason,
        },
      },
    });
  }),
});

if (import.meta.main) {
  await runHook(hook);
}
