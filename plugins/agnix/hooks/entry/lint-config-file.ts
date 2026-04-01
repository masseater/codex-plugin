#!/usr/bin/env bun
import { basename } from "node:path";
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import { isAgnixAvailable, runAgnix } from "../lib/agnix-runner.js";

using logger = HookLogger.fromFile(import.meta.filename);

export const CONFIG_FILE_PATTERNS = [
  /(?:^|\/)(CLAUDE|AGENTS|SKILL)\.md$/,
  /(?:^|\/)(hooks|plugin|settings)\.json$/,
  /\.mcp\.json$/,
  /(?:^|\/)\.claude\/rules\/.*\.md$/,
];

export const isConfigFile = (filePath: string): boolean =>
  CONFIG_FILE_PATTERNS.some((pattern) => pattern.test(filePath));

const hook = defineHook({
  trigger: {
    PostToolUse: {
      Write: true,
      Edit: true,
    },
  },
  run: wrapRun(logger, (context) => {
    const filePath = context.input.tool_input.file_path;

    if (!isConfigFile(filePath)) {
      return context.success({});
    }

    if (!isAgnixAvailable()) {
      logger.debug("agnix not found in PATH, skipping");
      return context.success({});
    }

    const { exitCode, output } = runAgnix(["--target", "claude-code", filePath], logger);

    if (exitCode === 0) {
      logger.debug(`agnix: no issues found in ${basename(filePath)}`);
      return context.success({});
    }

    logger.info(`agnix: issues found in ${basename(filePath)}`);
    return context.json({
      event: "PostToolUse" as const,
      output: {
        hookSpecificOutput: {
          hookEventName: "PostToolUse" as const,
          additionalContext: `agnix lint results for ${basename(filePath)}:\n${output}`,
        },
        suppressOutput: true,
      },
    });
  }),
});

if (import.meta.main) {
  await runHook(hook);
}
