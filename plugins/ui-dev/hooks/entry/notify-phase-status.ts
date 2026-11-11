#!/usr/bin/env bun
/**
 * Display phase-specific guidance when a session ends.
 * Called from figma-implement skill frontmatter hooks.
 */
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";

import { findConfigPath, loadUiDevConfig } from "../../lib/config.ts";

using logger = HookLogger.fromFile(import.meta.filename);

function buildImplementMessage(flowName: string, screens: string[]): string {
  return `[ui-dev] Ending implementation session.

The flow "${flowName}" is still in progress.
Screens: ${screens.join(", ")}

To resume:
/ui-dev:figma-implement ${flowName}`;
}

const hook = defineHook({
  trigger: { Stop: true },
  run: wrapRun(logger, (context) => {
    const configPath = findConfigPath();
    if (!configPath) {
      return context.success();
    }

    const config = loadUiDevConfig(configPath);
    const { currentPhase, name: flowName, screens } = config.flow;

    let reason: string | undefined;

    if (currentPhase === "implement") {
      logger.info(`Stop during implement for flow: ${flowName}`);
      reason = buildImplementMessage(flowName, screens);
    }

    if (!reason) {
      return context.success();
    }

    return context.json({
      event: "Stop" as const,
      output: { reason },
    });
  }),
});

if (import.meta.main) {
  await runHook(hook);
}
