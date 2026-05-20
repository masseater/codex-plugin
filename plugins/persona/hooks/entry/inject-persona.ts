#!/usr/bin/env bun
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import { personaPrompt, readPersona, resolveProjectDir, resolveStateFile } from "../lib/state.ts";

using logger = HookLogger.fromFile(import.meta.filename);

const hook = defineHook({
  trigger: { UserPromptSubmit: true },
  run: wrapRun(logger, (context) => {
    const projectDir = resolveProjectDir();
    if (!projectDir) {
      logger.warn("CLAUDE_PROJECT_DIR not set, skipping persona injection");
      return context.success({});
    }

    const sessionId = context.input.session_id;
    const stateFile = resolveStateFile(projectDir, sessionId);
    const persona = readPersona(stateFile);

    if (!persona) {
      return context.success({});
    }

    return context.json({
      event: "UserPromptSubmit" as const,
      output: {
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit" as const,
          additionalContext: personaPrompt(persona),
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
