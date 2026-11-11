#!/usr/bin/env bun
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import {
  markInjected,
  personaPrompt,
  readInjectedPersona,
  readPersona,
  resolveProjectDir,
  resolveStateFile,
} from "../lib/state.ts";

using logger = HookLogger.fromFile(import.meta.filename);

// persona の指示は transcript に残り続けるため、毎ターンではなく persona が変わったターンだけ注入する。
// compact 後の再注入は announce-persona（SessionStart）が担う。
const hook = defineHook({
  trigger: { UserPromptSubmit: true },
  run: wrapRun(logger, (context) => {
    const projectDir = resolveProjectDir();
    if (!projectDir) {
      logger.warn("CLAUDE_PROJECT_DIR not set, skipping persona injection");
      return context.success({});
    }

    const stateFile = resolveStateFile(projectDir, context.input.session_id);
    const persona = readPersona(stateFile);
    if (!persona || readInjectedPersona(stateFile) === persona) {
      return context.success({});
    }

    markInjected(stateFile, persona);
    return context.json({
      event: "UserPromptSubmit" as const,
      output: {
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit" as const,
          additionalContext: personaPrompt(persona),
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
