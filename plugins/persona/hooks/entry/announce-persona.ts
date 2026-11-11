#!/usr/bin/env bun
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import {
  markInjected,
  personaPrompt,
  readPersona,
  resolveProjectDir,
  resolveStateFile,
} from "../lib/state.ts";

using logger = HookLogger.fromFile(import.meta.filename);

// resume / compact でコンテキストから persona の指示が落ちるので、persona が設定済みなら再注入する。
const hook = defineHook({
  trigger: { SessionStart: true },
  run: wrapRun(logger, (context) => {
    const projectDir = resolveProjectDir();
    if (!projectDir) {
      return context.success({});
    }

    const stateFile = resolveStateFile(projectDir, context.input.session_id);
    const persona = readPersona(stateFile);
    if (!persona) {
      return context.success({});
    }

    markInjected(stateFile, persona);
    return context.json({
      event: "SessionStart" as const,
      output: {
        systemMessage: `現在のペルソナ: ${persona}`,
        hookSpecificOutput: {
          hookEventName: "SessionStart" as const,
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
