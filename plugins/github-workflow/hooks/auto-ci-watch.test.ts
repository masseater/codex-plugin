import type { Endpoints } from "@octokit/types";
import { afterEach, describe, expect, test, vi } from "vitest";

const { capturedHookDefs } = vi.hoisted(() => ({
  capturedHookDefs: [] as { run: (ctx: unknown) => unknown }[],
}));

vi.mock("@r_masseater/cc-plugin-lib", () => ({
  HookLogger: {
    fromFile: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      [Symbol.dispose]: vi.fn(),
    }),
  },
  wrapRun: vi.fn((_logger: unknown, fn: unknown) => fn),
}));

vi.mock("cc-hooks-ts", () => ({
  defineHook: vi.fn((def: { run: (ctx: unknown) => unknown }) => {
    capturedHookDefs.push(def);
    return def;
  }),
  runHook: vi.fn(),
}));

import {
  formatCIResult,
  formatConflictSkipMessage,
  getRepoInfo,
  waitForRun,
} from "./entry/auto-ci-watch.ts";
import type { CIWatchResult } from "./entry/auto-ci-watch.ts";
import { isGitPushCommand } from "./lib/pr-conflicts.ts";

type WorkflowRun = Endpoints["GET /repos/{owner}/{repo}/actions/runs/{run_id}"]["response"]["data"];
type Job =
  Endpoints["GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs"]["response"]["data"]["jobs"][number];

function makeRun(id: number, conclusion: WorkflowRun["conclusion"]): WorkflowRun {
  return { id, conclusion, status: "completed" } as WorkflowRun;
}

function makeJob(name: string, conclusion: Job["conclusion"]): Job {
  return { name, conclusion } as Job;
}

describe("isGitPushCommand", () => {
  test("matches simple git push", () => {
    expect(isGitPushCommand("git push")).toBe(true);
  });

  test("matches git push with remote and branch", () => {
    expect(isGitPushCommand("git push origin main")).toBe(true);
  });

  test("matches git push with flags", () => {
    expect(isGitPushCommand("git push -u origin feature/foo")).toBe(true);
  });

  test("matches git push --force", () => {
    expect(isGitPushCommand("git push --force")).toBe(true);
  });

  test("matches git push with extra whitespace", () => {
    expect(isGitPushCommand("git   push origin main")).toBe(true);
  });

  test("matches git push preceded by other commands", () => {
    expect(isGitPushCommand("cd /tmp && git push origin main")).toBe(true);
  });

  test("does not match git pull", () => {
    expect(isGitPushCommand("git pull")).toBe(false);
  });

  test("does not match git commit", () => {
    expect(isGitPushCommand("git commit -m 'test'")).toBe(false);
  });

  test("matches echo containing 'git push'", () => {
    expect(isGitPushCommand("echo 'use git push to deploy'")).toBe(true);
  });

  test("does not match empty string", () => {
    expect(isGitPushCommand("")).toBe(false);
  });

  test("does not match gitpush without space", () => {
    expect(isGitPushCommand("gitpush")).toBe(false);
  });
});

describe("formatCIResult", () => {
  const BRANCH = "feature/test-branch";

  test("returns no-runs message when run is null", () => {
    const result: CIWatchResult = { run: null, jobs: [] };
    expect(formatCIResult(BRANCH, result)).toBe(
      "[CI Watch] No workflow runs found for branch `feature/test-branch`.",
    );
  });

  test("formats successful CI run with no jobs", () => {
    const result: CIWatchResult = { run: makeRun(12345, "success"), jobs: [] };
    expect(formatCIResult(BRANCH, result)).toBe(
      "[CI Watch] Branch `feature/test-branch` — CI PASSED (run 12345)",
    );
  });

  test("formats failed CI run with no jobs", () => {
    const result: CIWatchResult = { run: makeRun(99, "failure"), jobs: [] };
    expect(formatCIResult(BRANCH, result)).toBe(
      "[CI Watch] Branch `feature/test-branch` — CI FAILED (run 99)",
    );
  });

  test("treats cancelled as UNKNOWN (not a failure)", () => {
    const result: CIWatchResult = { run: makeRun(42, "cancelled"), jobs: [] };
    expect(formatCIResult(BRANCH, result)).toBe(
      "[CI Watch] Branch `feature/test-branch` — CI UNKNOWN (run 42)",
    );
  });

  test("treats timed_out as FAILED", () => {
    const result: CIWatchResult = { run: makeRun(43, "timed_out"), jobs: [] };
    expect(formatCIResult(BRANCH, result)).toBe(
      "[CI Watch] Branch `feature/test-branch` — CI FAILED (run 43)",
    );
  });

  test("formats null conclusion as UNKNOWN", () => {
    const result: CIWatchResult = { run: makeRun(42, null), jobs: [] };
    expect(formatCIResult(BRANCH, result)).toBe(
      "[CI Watch] Branch `feature/test-branch` — CI UNKNOWN (run 42)",
    );
  });

  test("formats CI run with all passing jobs", () => {
    const result: CIWatchResult = {
      run: makeRun(100, "success"),
      jobs: [makeJob("lint", "success"), makeJob("test", "success")],
    };
    const expected = [
      "[CI Watch] Branch `feature/test-branch` — CI PASSED (run 100)",
      "",
      "- [pass] lint",
      "- [pass] test",
    ].join("\n");
    expect(formatCIResult(BRANCH, result)).toBe(expected);
  });

  test("skipped job is shown as [skipped] and not counted as failure", () => {
    const result: CIWatchResult = {
      run: makeRun(200, "failure"),
      jobs: [makeJob("lint", "success"), makeJob("test", "failure"), makeJob("deploy", "skipped")],
    };
    const expected = [
      "[CI Watch] Branch `feature/test-branch` — CI FAILED (run 200)",
      "",
      "- [pass] lint",
      "- [FAIL] test",
      "- [skipped] deploy",
      "",
      "Failed jobs: test. Run `gh run view 200 --log-failed` to see failure logs.",
    ].join("\n");
    expect(formatCIResult(BRANCH, result)).toBe(expected);
  });

  test("PASSED run with skipped release-style job stays PASSED", () => {
    const result: CIWatchResult = {
      run: makeRun(201, "success"),
      jobs: [makeJob("alpha", "success"), makeJob("release", "skipped")],
    };
    const expected = [
      "[CI Watch] Branch `feature/test-branch` — CI PASSED (run 201)",
      "",
      "- [pass] alpha",
      "- [skipped] release",
    ].join("\n");
    expect(formatCIResult(BRANCH, result)).toBe(expected);
  });

  test("formats single failed job", () => {
    const result: CIWatchResult = {
      run: makeRun(300, "failure"),
      jobs: [makeJob("build", "failure")],
    };
    const expected = [
      "[CI Watch] Branch `feature/test-branch` — CI FAILED (run 300)",
      "",
      "- [FAIL] build",
      "",
      "Failed jobs: build. Run `gh run view 300 --log-failed` to see failure logs.",
    ].join("\n");
    expect(formatCIResult(BRANCH, result)).toBe(expected);
  });

  test("appends clean merge status when no conflicts", () => {
    const result: CIWatchResult = { run: makeRun(400, "success"), jobs: [] };
    const expected = [
      "[CI Watch] Branch `feature/test-branch` — CI PASSED (run 400)",
      "",
      "[CI Watch] PR merge status: clean (base `main`)",
    ].join("\n");
    expect(
      formatCIResult(BRANCH, result, {
        baseBranch: "main",
        hasConflicts: false,
        conflictFiles: [],
      }),
    ).toBe(expected);
  });

  test("appends conflict details when PR has conflicts", () => {
    const result: CIWatchResult = { run: makeRun(401, "success"), jobs: [] };
    const expected = [
      "[CI Watch] Branch `feature/test-branch` — CI PASSED (run 401)",
      "",
      "[CI Watch] PR merge status: CONFLICTING with base `main`",
      "[CI Watch] Conflicted files: src/a.ts, src/b.ts",
      "[CI Watch] Resolve: git fetch origin main && git merge origin/main",
    ].join("\n");
    expect(
      formatCIResult(BRANCH, result, {
        baseBranch: "main",
        hasConflicts: true,
        conflictFiles: ["src/a.ts", "src/b.ts"],
      }),
    ).toBe(expected);
  });

  test("appends conflict without file list when files are unknown", () => {
    const result: CIWatchResult = { run: makeRun(402, "failure"), jobs: [] };
    const expected = [
      "[CI Watch] Branch `feature/test-branch` — CI FAILED (run 402)",
      "",
      "[CI Watch] PR merge status: CONFLICTING with base `develop`",
      "[CI Watch] Resolve: git fetch origin develop && git merge origin/develop",
    ].join("\n");
    expect(
      formatCIResult(BRANCH, result, {
        baseBranch: "develop",
        hasConflicts: true,
        conflictFiles: [],
      }),
    ).toBe(expected);
  });

  test("omits merge status when conflictStatus is undefined", () => {
    const result: CIWatchResult = { run: makeRun(403, "success"), jobs: [] };
    expect(formatCIResult(BRANCH, result, undefined)).toBe(
      "[CI Watch] Branch `feature/test-branch` — CI PASSED (run 403)",
    );
  });
});

describe("formatConflictSkipMessage", () => {
  test("states CI will not run and gives resolution steps with conflicted files", () => {
    const expected = [
      "[CI Watch] Branch `feature/test-branch` has merge conflicts with base `main`, so CI will NOT run until they are resolved.",
      "[CI Watch] Conflicted files: src/a.ts, src/b.ts",
      "[CI Watch] How to resolve:",
      "[CI Watch]   1. git fetch origin main && git merge origin/main",
      "[CI Watch]   2. Fix the conflicts, then: git add <files> && git merge --continue",
      "[CI Watch]   3. git push — CI runs on that push once the conflicts are gone.",
    ].join("\n");
    expect(formatConflictSkipMessage("feature/test-branch", "main", ["src/a.ts", "src/b.ts"])).toBe(
      expected,
    );
  });

  test("omits the conflicted-files line when none are known", () => {
    const expected = [
      "[CI Watch] Branch `feature/test-branch` has merge conflicts with base `main`, so CI will NOT run until they are resolved.",
      "[CI Watch] How to resolve:",
      "[CI Watch]   1. git fetch origin main && git merge origin/main",
      "[CI Watch]   2. Fix the conflicts, then: git add <files> && git merge --continue",
      "[CI Watch]   3. git push — CI runs on that push once the conflicts are gone.",
    ].join("\n");
    expect(formatConflictSkipMessage("feature/test-branch", "main", [])).toBe(expected);
  });
});

describe("waitForRun", () => {
  function makeOctokit(workflowRuns: { id: number }[][]) {
    let call = 0;
    return {
      actions: {
        listWorkflowRunsForRepo: vi.fn(async () => {
          const runs = workflowRuns[call] ?? [];
          call += 1;
          return { data: { workflow_runs: runs } };
        }),
      },
    } as never;
  }

  test("returns the first run when found on first poll", async () => {
    if (!globalThis.Bun) (globalThis as Record<string, unknown>).Bun = {};
    (globalThis.Bun as Record<string, unknown>).sleep = vi.fn(() => Promise.resolve());
    const octokit = makeOctokit([[{ id: 42 }]]);
    const result = await waitForRun(octokit, "owner", "repo", "main");
    expect(result?.id).toBe(42);
  });

  test("returns null when no runs are ever found", async () => {
    if (!globalThis.Bun) (globalThis as Record<string, unknown>).Bun = {};
    (globalThis.Bun as Record<string, unknown>).sleep = vi.fn(() => Promise.resolve());
    const octokit = makeOctokit([]);
    const result = await waitForRun(octokit, "owner", "repo", "main");
    expect(result).toBeNull();
  });

  test("retries when first poll returns empty then finds run", async () => {
    if (!globalThis.Bun) (globalThis as Record<string, unknown>).Bun = {};
    (globalThis.Bun as Record<string, unknown>).sleep = vi.fn(() => Promise.resolve());
    const octokit = makeOctokit([[], [{ id: 7 }]]);
    const result = await waitForRun(octokit, "owner", "repo", "main");
    expect(result?.id).toBe(7);
  });

  test("ignores API errors and keeps retrying", async () => {
    if (!globalThis.Bun) (globalThis as Record<string, unknown>).Bun = {};
    (globalThis.Bun as Record<string, unknown>).sleep = vi.fn(() => Promise.resolve());
    let call = 0;
    const octokit = {
      actions: {
        listWorkflowRunsForRepo: vi.fn(async () => {
          call += 1;
          if (call === 1) throw new Error("rate limited");
          return { data: { workflow_runs: [{ id: 99 }] } };
        }),
      },
    } as never;
    const result = await waitForRun(octokit, "owner", "repo", "main");
    expect(result?.id).toBe(99);
  });
});

describe("getRepoInfo", () => {
  const originalSpawnSync = globalThis.Bun?.spawnSync;

  function mockGitRemote(url: string) {
    const mockSpawnSync = vi.fn(() => ({
      stdout: { toString: () => url },
      stderr: { toString: () => "" },
    }));
    if (!globalThis.Bun) (globalThis as Record<string, unknown>).Bun = {};
    (globalThis.Bun as Record<string, unknown>).spawnSync = mockSpawnSync;
  }

  afterEach(() => {
    if (originalSpawnSync) {
      (globalThis.Bun as Record<string, unknown>).spawnSync = originalSpawnSync;
    }
  });

  test("parses https URL", () => {
    mockGitRemote("https://github.com/masseater/codex-plugin.git\n");
    expect(getRepoInfo()).toStrictEqual({ owner: "masseater", repo: "claude-code-plugin" });
  });

  test("parses ssh URL", () => {
    mockGitRemote("git@github.com:masseater/codex-plugin.git\n");
    expect(getRepoInfo()).toStrictEqual({ owner: "masseater", repo: "claude-code-plugin" });
  });

  test("parses URL without .git suffix", () => {
    mockGitRemote("https://github.com/owner/repo\n");
    expect(getRepoInfo()).toStrictEqual({ owner: "owner", repo: "repo" });
  });

  test("returns null for empty output", () => {
    mockGitRemote("");
    expect(getRepoInfo()).toBeNull();
  });
});

describe("hook run", () => {
  const originalSpawnSync = globalThis.Bun?.spawnSync;

  function createMockContext(command: string) {
    const successResult = { type: "success" };
    const deferResult = { type: "defer" };
    return {
      input: { tool_input: { command } },
      success: vi.fn(() => successResult),
      defer: vi.fn(() => deferResult),
    };
  }

  function getHookRun() {
    const hookDef = capturedHookDefs[0];
    if (!hookDef) throw new Error("Hook not captured");
    return hookDef.run;
  }

  function mockBunSpawnSync(branch: string | null) {
    const mockSpawnSync = vi.fn(() => ({
      stdout: { toString: () => branch ?? "" },
      stderr: { toString: () => "" },
    }));
    if (!globalThis.Bun) (globalThis as Record<string, unknown>).Bun = {};
    (globalThis.Bun as Record<string, unknown>).spawnSync = mockSpawnSync;
    return mockSpawnSync;
  }

  afterEach(() => {
    if (originalSpawnSync) {
      (globalThis.Bun as Record<string, unknown>).spawnSync = originalSpawnSync;
    }
  });

  test("returns success for non-push commands", () => {
    const ctx = createMockContext("git pull origin main");
    const result = getHookRun()(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.defer).not.toHaveBeenCalled();
    expect(result).toStrictEqual({ type: "success" });
  });

  test("returns success for git status", () => {
    const ctx = createMockContext("git status");
    getHookRun()(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.defer).not.toHaveBeenCalled();
  });

  test("returns success for git commit", () => {
    const ctx = createMockContext("git commit -m 'fix bug'");
    getHookRun()(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
  });

  test("returns success when branch is null", () => {
    mockBunSpawnSync(null);
    const ctx = createMockContext("git push origin main");
    getHookRun()(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.defer).not.toHaveBeenCalled();
  });

  test("returns success on detached HEAD", () => {
    mockBunSpawnSync("HEAD");
    const ctx = createMockContext("git push origin main");
    getHookRun()(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.defer).not.toHaveBeenCalled();
  });

  test("defers when git push detected on a valid branch", () => {
    mockBunSpawnSync("feature/my-branch");
    const ctx = createMockContext("git push origin main");
    getHookRun()(ctx);
    expect(ctx.defer).toHaveBeenCalled();
    expect(ctx.success).not.toHaveBeenCalled();
  });
});
