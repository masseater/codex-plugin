#!/usr/bin/env bun
/**
 * Block Figma MCP's get_screenshot and redirect to the ui-dev:figma-screenshot skill.
 * Called from prepare, figma-implement skill frontmatter hooks.
 */
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";

using logger = HookLogger.fromFile(import.meta.filename);

const hook = defineHook({
  trigger: { PreToolUse: true },
  run: wrapRun(logger, (context) => {
    logger.info("Redirecting get_screenshot to figma-screenshot skill");

    return context.json({
      event: "PreToolUse" as const,
      output: {
        decision: "block" as const,
        reason:
          "Use the ui-dev:figma-screenshot skill instead of get_screenshot. " +
          "Run: export-screenshot.ts --file-key <key> --node-id <id> --output <path>",
      },
    });
  }),
});

if (import.meta.main) {
  await runHook(hook);
}
