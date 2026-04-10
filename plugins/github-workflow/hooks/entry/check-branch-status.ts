#!/usr/bin/env bun
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import {
  checkConflictsWithBase,
  formatConflictResolutionMessage,
  getCurrentBranch,
  getPrBaseBranch,
  getRemoteTrackingBranch,
  getUnpushedStatus,
  isGitRepo,
  parseMergeTreeOutput,
  parseRevListCount,
} from "../lib/pr-conflicts.ts";

using logger = HookLogger.fromFile(import.meta.filename);

const hook = defineHook({
  trigger: {
    Stop: true,
  },
  run: wrapRun(logger, (context) => {
    if (context.input.stop_hook_active) {
      logger.debug("Skipping: already blocked once this turn");
      return context.success({});
    }

    if (!isGitRepo()) {
      logger.debug("Skipping: not a git repository");
      return context.success({});
    }

    const branch = getCurrentBranch();
    if (branch === undefined) {
      logger.debug("Skipping: detached HEAD");
      return context.success({});
    }

    const messages: string[] = [];

    // 1. Check remote integration status
    const upstream = getRemoteTrackingBranch(branch);
    if (upstream === undefined) {
      messages.push(
        `[git] Branch "${branch}" has no remote tracking branch. Consider pushing with: git push -u origin ${branch}`,
      );
    } else {
      const status = getUnpushedStatus(branch, upstream);
      if (status !== undefined) {
        if (status.ahead > 0) {
          messages.push(
            `[git] Branch "${branch}" is ${status.ahead} commit(s) ahead of ${upstream}. Unpushed changes exist.`,
          );
        }
        if (status.behind > 0) {
          messages.push(
            `[git] Branch "${branch}" is ${status.behind} commit(s) behind ${upstream}. Consider pulling.`,
          );
        }
        if (status.ahead === 0 && status.behind === 0) {
          logger.debug(`Branch "${branch}" is up to date with ${upstream}`);
        }
      }
    }

    // 2. Check PR base branch conflicts
    const baseBranch = getPrBaseBranch(branch);
    if (baseBranch !== undefined) {
      logger.debug(`PR base branch: ${baseBranch}`);
      const { hasConflicts, conflictFiles } = checkConflictsWithBase(baseBranch);
      if (hasConflicts) {
        messages.push(formatConflictResolutionMessage(branch, baseBranch, conflictFiles));
      } else {
        logger.debug(`No conflicts with base branch "${baseBranch}"`);
      }
    } else {
      logger.debug("No PR found for current branch");
    }

    if (messages.length === 0) {
      logger.info("Branch status: all clear");
      return context.success({});
    }

    const reason = messages.join("\n");
    logger.info(`Branch status notifications:\n${reason}`);

    return context.json({
      event: "Stop",
      output: {
        decision: "block",
        reason,
      },
    });
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

export { parseMergeTreeOutput, parseRevListCount };
