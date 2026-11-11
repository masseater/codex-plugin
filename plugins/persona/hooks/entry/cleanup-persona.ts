#!/usr/bin/env bun
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import { clearPersona, resolveProjectDir, resolveStateFile } from "../lib/state.ts";

using logger = HookLogger.fromFile(import.meta.filename);

const hook = defineHook({
  trigger: { SessionEnd: true },
  run: wrapRun(logger, (context) => {
    const projectDir = resolveProjectDir();
    if (!projectDir) {
      return context.success({});
    }

    const sessionId = context.input.session_id;
    const stateFile = resolveStateFile(projectDir, sessionId);
    clearPersona(stateFile);
    logger.debug(`Cleared persona state for session ${sessionId}`);
    return context.success({});
  }),
});

/* v8 ignore next 3 */
if (import.meta.main) {
  await runHook(hook);
}
