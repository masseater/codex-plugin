#!/usr/bin/env bun
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import {
  markInjected,
  personaPrompt,
  readPersona,
  resolveProjectDir,
  resolveStateFile,
  writePersona,
} from "../lib/state.ts";

using logger = HookLogger.fromFile(import.meta.filename);

// planner の「実装しない」指示が承認後も残ると実装に入れないため、planner のときだけ worker に切り替える。
// persona 未設定や他の persona のセッションでは何もしない。
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
    if (readPersona(stateFile) !== "planner") {
      return context.success({});
    }

    writePersona(stateFile, "worker");
    markInjected(stateFile, "worker");
    logger.info(`Persona switched to worker for session ${sessionId}`);

    return context.json({
      event: "PostToolUse" as const,
      output: {
        systemMessage: "✓ plan承認を検知。ペルソナを worker に切り替えました",
        hookSpecificOutput: {
          hookEventName: "PostToolUse" as const,
          additionalContext: personaPrompt("worker"),
        },
      },
    });
  }),
});

/* v8 ignore start */
if (import.meta.main) {
  await runHook(hook);
}
/* v8 ignore stop */
