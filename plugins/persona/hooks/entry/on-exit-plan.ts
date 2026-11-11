#!/usr/bin/env bun
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import { personaPrompt, resolveProjectDir, resolveStateFile, writePersona } from "../lib/state.ts";

using logger = HookLogger.fromFile(import.meta.filename);

const hook = defineHook({
  trigger: { PostToolUse: { ExitPlanMode: true } },
  run: wrapRun(logger, (context) => {
    const projectDir = resolveProjectDir();
    if (!projectDir) {
      logger.warn("CLAUDE_PROJECT_DIR not set, skipping persona switch");
      return context.success({});
    }

    const sessionId = context.input.session_id;
    const stateFile = resolveStateFile(projectDir, sessionId);
    writePersona(stateFile, "worker");
    logger.info(`Persona switched to worker for session ${sessionId}`);

    return context.json({
      event: "PostToolUse" as const,
      output: {
        systemMessage: "✓ plan承認を検知。ペルソナを worker に切り替えました",
        hookSpecificOutput: {
          hookEventName: "PostToolUse" as const,
          additionalContext: personaPrompt("worker"),
        },
        suppressOutput: true,
      },
    });
  }),
});

/* v8 ignore next 3 */
if (import.meta.main) {
  await runHook(hook);
}
