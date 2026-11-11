#!/usr/bin/env bun
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import {
  buildDebugMessage,
  resolveDebugFile,
  resolveStateDir,
  writeDebugFile,
} from "../lib/debug-file.ts";

using logger = HookLogger.fromFile(import.meta.filename);

const hook = defineHook({
  trigger: {
    SessionStart: true,
  },
  run: wrapRun(logger, async (context) => {
    const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT ?? new URL("../..", import.meta.url).pathname;
    const stateDir = resolveStateDir();
    const debugFile = resolveDebugFile(stateDir);

    writeDebugFile(debugFile, pluginRoot);
    const message = buildDebugMessage(debugFile, pluginRoot);

    return context.json({
      event: "SessionStart" as const,
      output: {
        hookSpecificOutput: {
          hookEventName: "SessionStart" as const,
          additionalContext: message,
        },
        suppressOutput: true,
      },
    });
  }),
});

if (import.meta.main) {
  await runHook(hook);
}
