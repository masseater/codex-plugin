#!/usr/bin/env bun
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";

using logger = HookLogger.fromFile(import.meta.filename);

const CI_CONCLUSION_SUCCESS = "success";
const CI_CONCLUSION_FAILURE = "failure";
const CI_WATCH_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const RUN_POLL_INTERVAL_MS = 3000;
const RUN_POLL_MAX_RETRIES = 10;

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
        const result = await watchCI(currentBranch);
        const additionalContext = formatCIResult(currentBranch, result);

        logger.info(`CI watch complete: ${result.conclusion ?? "unknown"}`);

        return {
          event: "PostToolUse" as const,
          output: {
            ...(result.conclusion === CI_CONCLUSION_FAILURE && {
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

export function isGitPushCommand(command: string): boolean {
  return /\bgit\s+push\b/.test(command);
}

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

export type CIResult = {
  runId: number | null;
  conclusion: string | null;
  jobs: CIJob[];
};

export type CIJob = {
  name: string;
  conclusion: string;
};

export async function waitForRun(branch: string): Promise<number | null> {
  for (let i = 0; i < RUN_POLL_MAX_RETRIES; i++) {
    const proc = Bun.spawn(
      ["gh", "run", "list", "--branch", branch, "--limit", "1", "--json", "databaseId"],
      { stdout: "pipe", stderr: "pipe" },
    );
    await proc.exited;

    const stdout = await new Response(proc.stdout).text();
    try {
      const runs = JSON.parse(stdout) as {
        databaseId: number;
      }[];
      if (runs.length > 0 && runs[0]) {
        return runs[0].databaseId;
      }
    } catch {
      logger.debug(`Failed to parse gh run list output: ${stdout}`);
    }

    logger.debug(
      `No runs found yet for branch ${branch}, retrying (${i + 1}/${RUN_POLL_MAX_RETRIES})`,
    );
    await Bun.sleep(RUN_POLL_INTERVAL_MS);
  }
  return null;
}

export async function watchCI(branch: string): Promise<CIResult> {
  const runId = await waitForRun(branch);
  if (!runId) {
    logger.warn(`No CI runs found for branch ${branch}`);
    return { runId: null, conclusion: null, jobs: [] };
  }

  logger.info(`Watching CI run ${runId}`);

  const watchProc = Bun.spawn(["gh", "run", "watch", String(runId), "--exit-status"], {
    stdout: "ignore",
    stderr: "ignore",
  });
  await watchProc.exited;

  const viewProc = Bun.spawn(["gh", "run", "view", String(runId), "--json", "conclusion,jobs"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  await viewProc.exited;

  const viewStdout = await new Response(viewProc.stdout).text();
  try {
    const result = JSON.parse(viewStdout) as {
      conclusion: string;
      jobs: CIJob[];
    };
    return { runId, conclusion: result.conclusion, jobs: result.jobs };
  } catch {
    logger.warn(`Failed to parse gh run view output: ${viewStdout}`);
    return { runId, conclusion: null, jobs: [] };
  }
}

export function formatCIResult(branch: string, result: CIResult): string {
  if (!result.runId) {
    return `[CI Watch] No workflow runs found for branch \`${branch}\`.`;
  }

  const status =
    result.conclusion === CI_CONCLUSION_SUCCESS
      ? "PASSED"
      : result.conclusion === CI_CONCLUSION_FAILURE
        ? "FAILED"
        : "UNKNOWN";
  const lines = [`[CI Watch] Branch \`${branch}\` — CI ${status} (run ${result.runId})`];

  const failedJobNames: string[] = [];
  if (result.jobs.length > 0) {
    lines.push("");
    for (const job of result.jobs) {
      const passed = job.conclusion === CI_CONCLUSION_SUCCESS;
      lines.push(`- [${passed ? "pass" : "FAIL"}] ${job.name}`);
      if (!passed) failedJobNames.push(job.name);
    }
  }

  if (failedJobNames.length > 0) {
    lines.push("");
    lines.push(
      `Failed jobs: ${failedJobNames.join(", ")}. Run \`gh run view ${result.runId} --log-failed\` to see failure logs.`,
    );
  }

  return lines.join("\n");
}

if (import.meta.main) {
  await runHook(hook);
}
