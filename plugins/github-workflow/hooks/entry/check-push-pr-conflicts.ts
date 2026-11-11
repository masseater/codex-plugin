#!/usr/bin/env bun
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import {
  formatConflictResolutionMessage,
  getCurrentBranch,
  getPrConflictStatus,
  isGitPushCommand,
} from "../lib/pr-conflicts.ts";

using logger = HookLogger.fromFile(import.meta.filename);

const hook = defineHook({
  trigger: {
    PostToolUse: {
      Bash: true,
    },
  },
  run: wrapRun(logger, (context) => {
    const command = context.input.tool_input.command;
    if (!isGitPushCommand(command)) {
      return context.success({});
    }

    const branch = getCurrentBranch();
    if (!branch || branch === "HEAD") {
      logger.debug("Skipping push conflict check: current branch is unavailable");
      return context.success({});
    }

    const prConflictStatus = getPrConflictStatus(branch);
    if (!prConflictStatus) {
      logger.debug(`Skipping push conflict check: no PR found for branch ${branch}`);
      return context.success({});
    }

    if (!prConflictStatus.hasConflicts) {
      logger.debug(
        `Push conflict check clear: branch ${branch} has no conflicts with ${prConflictStatus.baseBranch}`,
      );
      return context.success({});
    }

    const additionalContext = formatConflictResolutionMessage(
      branch,
      prConflictStatus.baseBranch,
      prConflictStatus.conflictFiles,
    );
    logger.info(additionalContext);

    return context.json({
      event: "PostToolUse",
      output: {
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext,
        },
      },
    });
  }),
});

if (import.meta.main) {
  await runHook(hook);
}
