#!/usr/bin/env bun
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import {
  checkConflictsWithBase,
  formatConflictResolutionMessage,
  formatPullFailureMessage,
  formatPushFailureMessage,
  getCurrentBranch,
  getPrBaseBranch,
  getRemoteTrackingBranch,
  getUnpushedStatus,
  isGitRepo,
  parseMergeTreeOutput,
  parseRevListCount,
  tryAutoPush,
  tryFastForwardPull,
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

    const blockMessages: string[] = [];
    const systemMessages: string[] = [];

    // 1. Check remote integration status
    const upstream = getRemoteTrackingBranch(branch);
    if (upstream === undefined) {
      blockMessages.push(
        `[git] Branch "${branch}" has no remote tracking branch. Consider pushing with: git push -u origin ${branch}`,
      );
    } else {
      const status = getUnpushedStatus(branch, upstream);
      if (status !== undefined) {
        if (status.behind > 0) {
          const pull = tryFastForwardPull(status.behind);
          if (pull.ok) {
            const message = `[git] Auto-pulled ${pull.pulled} commit(s) from ${upstream} into "${branch}".`;
            systemMessages.push(message);
            logger.info(message);
          } else {
            const message = formatPullFailureMessage(branch, upstream, status.behind, pull.reason);
            blockMessages.push(message);
            logger.warn(`Auto-pull failed: ${pull.reason}`);
          }
        }
        if (status.ahead > 0) {
          const push = tryAutoPush();
          if (push.ok) {
            const message = `[git] Auto-pushed ${status.ahead} commit(s) from "${branch}" to ${upstream}.`;
            systemMessages.push(message);
            logger.info(message);
          } else {
            const message = formatPushFailureMessage(branch, upstream, status.ahead, push.reason);
            blockMessages.push(message);
            logger.warn(`Auto-push failed: ${push.reason}`);
          }
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
        blockMessages.push(formatConflictResolutionMessage(branch, baseBranch, conflictFiles));
      } else {
        logger.debug(`No conflicts with base branch "${baseBranch}"`);
      }
    } else {
      logger.debug("No PR found for current branch");
    }

    if (blockMessages.length === 0 && systemMessages.length === 0) {
      logger.info("Branch status: all clear");
      return context.success({});
    }

    if (blockMessages.length === 0) {
      return context.json({
        event: "Stop",
        output: {
          systemMessage: systemMessages.join("\n"),
        },
      });
    }

    const reason = blockMessages.join("\n");
    logger.info(`Branch status notifications:\n${reason}`);

    return context.json({
      event: "Stop",
      output: {
        decision: "block",
        reason,
        ...(systemMessages.length > 0 && { systemMessage: systemMessages.join("\n") }),
      },
    });
  }),
});

if (import.meta.main) {
  await runHook(hook);
}

export { parseMergeTreeOutput, parseRevListCount };
