#!/usr/bin/env bun
import { Octokit } from "@octokit/rest";
import type { Endpoints } from "@octokit/types";
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import {
  type PrConflictStatus,
  getPrConflictStatus,
  isGitPushCommand,
} from "../lib/pr-conflicts.ts";

using logger = HookLogger.fromFile(import.meta.filename);

const CI_CONCLUSION_SUCCESS = "success";
const FAILURE_CONCLUSIONS = new Set(["failure", "timed_out", "startup_failure", "action_required"]);
const CI_WATCH_TIMEOUT_MS = 10 * 60 * 1000;
const RUN_POLL_INTERVAL_MS = 3000;
const RUN_POLL_MAX_RETRIES = 10;
const RUN_STATUS_POLL_INTERVAL_MS = 5000;

type WorkflowRun = Endpoints["GET /repos/{owner}/{repo}/actions/runs/{run_id}"]["response"]["data"];
type Job =
  Endpoints["GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs"]["response"]["data"]["jobs"][number];

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

    const currentBranch = getCurrentBranch();
    if (!currentBranch || currentBranch === "HEAD") {
      logger.warn("Could not determine current branch");
      return context.success({});
    }

    logger.info(`Git push detected on branch: ${currentBranch}`);

    return context.defer(
      async () => {
        const preConflictStatus = getPrConflictStatus(currentBranch);
        if (preConflictStatus?.hasConflicts) {
          logger.info(
            `CI watch skipped: PR for ${currentBranch} has conflicts with ${preConflictStatus.baseBranch}`,
          );
          return {
            event: "PostToolUse" as const,
            output: {
              hookSpecificOutput: {
                hookEventName: "PostToolUse" as const,
                additionalContext: formatConflictSkipMessage(
                  currentBranch,
                  preConflictStatus.baseBranch,
                  preConflictStatus.conflictFiles,
                ),
              },
            },
          };
        }

        const result = await watchCI(currentBranch);
        const conflictStatus = getPrConflictStatus(currentBranch);
        const additionalContext = formatCIResult(currentBranch, result, conflictStatus);

        logger.info(`CI watch complete: ${result.run?.conclusion ?? "unknown"}`);

        const failed = FAILURE_CONCLUSIONS.has(result.run?.conclusion ?? "");
        return {
          event: "PostToolUse" as const,
          output: {
            ...(failed && {
              systemMessage: `CI failed on branch ${currentBranch}. Check the details below.`,
            }),
            hookSpecificOutput: {
              hookEventName: "PostToolUse" as const,
              additionalContext,
            },
          },
        };
      },
      { timeoutMs: CI_WATCH_TIMEOUT_MS },
    );
  }),
});

function getCurrentBranch(): string | null {
  try {
    const result = Bun.spawnSync(["git", "rev-parse", "--abbrev-ref", "HEAD"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const branch = result.stdout.toString().trim();
    return branch || null;
  } catch {
    return null;
  }
}

export function getRepoInfo(): { owner: string; repo: string } | null {
  try {
    const result = Bun.spawnSync(["git", "remote", "get-url", "origin"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const url = result.stdout.toString().trim();
    const match = url.match(/[:/]([^/]+)\/([^/.]+?)(?:\.git)?$/);
    if (!match || !match[1] || !match[2]) return null;
    return { owner: match[1], repo: match[2] };
  } catch {
    return null;
  }
}

export function getGithubToken(): string | null {
  if (process.env["GITHUB_TOKEN"]) return process.env["GITHUB_TOKEN"];
  try {
    const result = Bun.spawnSync(["gh", "auth", "token"], { stdout: "pipe", stderr: "pipe" });
    const token = result.stdout.toString().trim();
    return token || null;
  } catch {
    return null;
  }
}

function makeOctokit(): Octokit | null {
  const token = getGithubToken();
  if (!token) {
    logger.warn("No GitHub token available (set GITHUB_TOKEN or run `gh auth login`)");
    return null;
  }
  return new Octokit({ auth: token });
}

export type CIWatchResult = {
  run: WorkflowRun | null;
  jobs: Job[];
};

export async function waitForRun(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
): Promise<WorkflowRun | null> {
  for (let i = 0; i < RUN_POLL_MAX_RETRIES; i++) {
    try {
      const res = await octokit.actions.listWorkflowRunsForRepo({
        owner,
        repo,
        branch,
        per_page: 1,
      });
      const run = res.data.workflow_runs[0];
      if (run) return run;
    } catch (error) {
      logger.debug(
        `Failed to list runs: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    logger.debug(
      `No runs found yet for branch ${branch}, retrying (${i + 1}/${RUN_POLL_MAX_RETRIES})`,
    );
    await Bun.sleep(RUN_POLL_INTERVAL_MS);
  }
  return null;
}

export async function watchCI(branch: string): Promise<CIWatchResult> {
  const octokit = makeOctokit();
  const repoInfo = getRepoInfo();
  if (!octokit || !repoInfo) {
    return { run: null, jobs: [] };
  }
  const { owner, repo } = repoInfo;

  let run = await waitForRun(octokit, owner, repo, branch);
  if (!run) {
    logger.warn(`No CI runs found for branch ${branch}`);
    return { run: null, jobs: [] };
  }

  logger.info(`Watching CI run ${run.id}`);

  while (run.status !== "completed") {
    await Bun.sleep(RUN_STATUS_POLL_INTERVAL_MS);
    try {
      const res = await octokit.actions.getWorkflowRun({ owner, repo, run_id: run.id });
      run = res.data;
    } catch (error) {
      logger.warn(
        `Failed to poll run ${run.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      break;
    }
  }

  let jobs: Job[] = [];
  try {
    const res = await octokit.actions.listJobsForWorkflowRun({ owner, repo, run_id: run.id });
    jobs = res.data.jobs;
  } catch (error) {
    logger.warn(
      `Failed to list jobs for run ${run.id}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return { run, jobs };
}

export function formatCIResult(
  branch: string,
  result: CIWatchResult,
  conflictStatus?: PrConflictStatus,
): string {
  if (!result.run) {
    return `[CI Watch] No workflow runs found for branch \`${branch}\`.`;
  }

  const conclusion = result.run.conclusion ?? "";
  const status =
    conclusion === CI_CONCLUSION_SUCCESS
      ? "PASSED"
      : FAILURE_CONCLUSIONS.has(conclusion)
        ? "FAILED"
        : "UNKNOWN";
  const lines = [`[CI Watch] Branch \`${branch}\` — CI ${status} (run ${result.run.id})`];

  const failedJobNames: string[] = [];
  if (result.jobs.length > 0) {
    lines.push("");
    for (const job of result.jobs) {
      if (job.conclusion === CI_CONCLUSION_SUCCESS) {
        lines.push(`- [pass] ${job.name}`);
      } else if (FAILURE_CONCLUSIONS.has(job.conclusion ?? "")) {
        lines.push(`- [FAIL] ${job.name}`);
        failedJobNames.push(job.name);
      } else {
        lines.push(`- [${job.conclusion ?? "pending"}] ${job.name}`);
      }
    }
  }

  if (failedJobNames.length > 0) {
    lines.push("");
    lines.push(
      `Failed jobs: ${failedJobNames.join(", ")}. Run \`gh run view ${result.run.id} --log-failed\` to see failure logs.`,
    );
  }

  if (conflictStatus) {
    lines.push("");
    if (conflictStatus.hasConflicts) {
      lines.push(
        `[CI Watch] PR merge status: CONFLICTING with base \`${conflictStatus.baseBranch}\``,
      );
      if (conflictStatus.conflictFiles.length > 0) {
        lines.push(`[CI Watch] Conflicted files: ${conflictStatus.conflictFiles.join(", ")}`);
      }
      lines.push(
        `[CI Watch] Resolve: git fetch origin ${conflictStatus.baseBranch} && git merge origin/${conflictStatus.baseBranch}`,
      );
    } else {
      lines.push(`[CI Watch] PR merge status: clean (base \`${conflictStatus.baseBranch}\`)`);
    }
  }

  return lines.join("\n");
}

export function formatConflictSkipMessage(
  branch: string,
  baseBranch: string,
  conflictFiles: string[],
): string {
  const lines = [
    `[CI Watch] Branch \`${branch}\` has merge conflicts with base \`${baseBranch}\`, so CI will NOT run until they are resolved.`,
  ];

  if (conflictFiles.length > 0) {
    lines.push(`[CI Watch] Conflicted files: ${conflictFiles.join(", ")}`);
  }

  lines.push("[CI Watch] How to resolve:");
  lines.push(`[CI Watch]   1. git fetch origin ${baseBranch} && git merge origin/${baseBranch}`);
  lines.push("[CI Watch]   2. Fix the conflicts, then: git add <files> && git merge --continue");
  lines.push("[CI Watch]   3. git push — CI runs on that push once the conflicts are gone.");

  return lines.join("\n");
}

if (import.meta.main) {
  await runHook(hook);
}
