#!/usr/bin/env bun
import { HookLogger, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import { getCurrentBranch, isGitPushCommand } from "../lib/pr-conflicts.ts";

using logger = HookLogger.fromFile(import.meta.filename);

const PR_CREATE_TIMEOUT_MS = 30_000;

function getDefaultBranch(): string | null {
  try {
    const result = Bun.spawnSync(
      ["gh", "repo", "view", "--json", "defaultBranchRef", "--jq", ".defaultBranchRef.name"],
      { stdout: "pipe", stderr: "pipe" },
    );
    const branch = result.stdout.toString().trim();
    return branch || null;
  } catch {
    return null;
  }
}

function prExists(branch: string): boolean {
  const result = Bun.spawnSync(["gh", "pr", "view", branch, "--json", "number"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return result.exitCode === 0;
}

type PrCreateResult = {
  created: boolean;
  url: string | null;
  title: string | null;
  error: string | null;
};

async function createPr(branch: string): Promise<PrCreateResult> {
  const proc = Bun.spawn(["gh", "pr", "create", "--fill", "--head", branch], {
    stdout: "pipe",
    stderr: "pipe",
  });
  await proc.exited;

  const stdout = (await new Response(proc.stdout).text()).trim();
  const stderr = (await new Response(proc.stderr).text()).trim();

  if (proc.exitCode !== 0) {
    return { created: false, url: null, title: null, error: stderr || "Unknown error" };
  }

  // gh pr create --fill outputs the PR URL on success
  const url = stdout;

  // Fetch the title from the created PR
  let title: string | null = null;
  try {
    const viewProc = Bun.spawn(["gh", "pr", "view", branch, "--json", "title", "--jq", ".title"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await viewProc.exited;
    title = (await new Response(viewProc.stdout).text()).trim() || null;
  } catch {
    // title is optional
  }

  return { created: true, url, title, error: null };
}

function formatResult(branch: string, result: PrCreateResult): string {
  if (!result.created) {
    return `[PR Auto-Create] Failed to create PR for branch \`${branch}\`: ${result.error}`;
  }

  const lines = [`[PR Auto-Create] Created PR for branch \`${branch}\``];
  if (result.title) {
    lines.push(`Title: ${result.title}`);
  }
  if (result.url) {
    lines.push(`URL: ${result.url}`);
  }
  return lines.join("\n");
}

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
      logger.debug("Skipping auto-create-pr: current branch is unavailable");
      return context.success({});
    }

    const defaultBranch = getDefaultBranch();
    if (branch === defaultBranch) {
      logger.debug("Skipping auto-create-pr: on default branch");
      return context.success({});
    }

    if (prExists(branch)) {
      logger.debug(`Skipping auto-create-pr: PR already exists for branch ${branch}`);
      return context.success({});
    }

    logger.info(`No PR found for branch ${branch}, creating one...`);

    return context.defer(
      async () => {
        const result = await createPr(branch);
        const additionalContext = formatResult(branch, result);

        if (result.created) {
          logger.info(`PR created: ${result.url}`);
        } else {
          logger.warn(`PR creation failed: ${result.error}`);
        }

        return {
          event: "PostToolUse" as const,
          output: {
            hookSpecificOutput: {
              hookEventName: "PostToolUse" as const,
              additionalContext,
            },
          },
        };
      },
      { timeoutMs: PR_CREATE_TIMEOUT_MS },
    );
  }),
});

if (import.meta.main) {
  await runHook(hook);
}
