#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";

using logger = HookLogger.fromFile(import.meta.filename);

function git(...args: string[]): string {
  return execFileSync("git", args, {
    encoding: "utf-8",
    timeout: 10_000,
  }).trim();
}

function isGitRepo(): boolean {
  try {
    return git("rev-parse", "--is-inside-work-tree") === "true";
  } catch {
    return false;
  }
}

const hook = defineHook({
  trigger: {
    Stop: true,
  },
  run: wrapRun(logger, (context) => {
    if (context.input.stop_hook_active) {
      logger.debug("Skipping: stop_hook_active is true");
      return context.success({});
    }

    if (!isGitRepo()) {
      logger.debug("Skipping: not a git repository");
      return context.success({});
    }

    logger.debug("Running git status and git diff");
    const gitStatus = git("status");
    const gitDiff = git("diff");

    logger.info(gitStatus);
    if (gitDiff) {
      logger.debug(`Git diff has ${gitDiff.split("\n").length} lines`);
      logger.info(gitDiff);
    } else {
      logger.debug("No unstaged changes");
    }

    return context.success({});
  }),
});

if (import.meta.main) {
  await runHook(hook);
}
