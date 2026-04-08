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

import { formatCIResult, waitForRun, watchCI } from "./entry/auto-ci-watch.ts";
import type { CIResult } from "./entry/auto-ci-watch.ts";
import { isGitPushCommand } from "./lib/pr-conflicts.ts";

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

  test("does not match echo containing git push as substring", () => {
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

  test("returns no-runs message when runId is null", () => {
    const result: CIResult = { runId: null, conclusion: null, jobs: [] };
    const output = formatCIResult(BRANCH, result);
    expect(output).toBe("[CI Watch] No workflow runs found for branch `feature/test-branch`.");
  });

  test("formats successful CI run with no jobs", () => {
    const result: CIResult = { runId: 12345, conclusion: "success", jobs: [] };
    const output = formatCIResult(BRANCH, result);
    expect(output).toBe("[CI Watch] Branch `feature/test-branch` — CI PASSED (run 12345)");
  });

  test("formats failed CI run with no jobs", () => {
    const result: CIResult = { runId: 99, conclusion: "failure", jobs: [] };
    const output = formatCIResult(BRANCH, result);
    expect(output).toBe("[CI Watch] Branch `feature/test-branch` — CI FAILED (run 99)");
  });

  test("formats unknown conclusion", () => {
    const result: CIResult = { runId: 42, conclusion: "cancelled", jobs: [] };
    const output = formatCIResult(BRANCH, result);
    expect(output).toBe("[CI Watch] Branch `feature/test-branch` — CI UNKNOWN (run 42)");
  });

  test("formats null conclusion as UNKNOWN", () => {
    const result: CIResult = { runId: 42, conclusion: null, jobs: [] };
    const output = formatCIResult(BRANCH, result);
    expect(output).toBe("[CI Watch] Branch `feature/test-branch` — CI UNKNOWN (run 42)");
  });

  test("formats CI run with all passing jobs", () => {
    const result: CIResult = {
      runId: 100,
      conclusion: "success",
      jobs: [
        { name: "lint", conclusion: "success" },
        { name: "test", conclusion: "success" },
      ],
    };
    const output = formatCIResult(BRANCH, result);
    const expected = [
      "[CI Watch] Branch `feature/test-branch` — CI PASSED (run 100)",
      "",
      "- [pass] lint",
      "- [pass] test",
    ].join("\n");
    expect(output).toBe(expected);
  });

  test("formats CI run with mixed job results", () => {
    const result: CIResult = {
      runId: 200,
      conclusion: "failure",
      jobs: [
        { name: "lint", conclusion: "success" },
        { name: "test", conclusion: "failure" },
        { name: "deploy", conclusion: "skipped" },
      ],
    };
    const output = formatCIResult(BRANCH, result);
    const expected = [
      "[CI Watch] Branch `feature/test-branch` — CI FAILED (run 200)",
      "",
      "- [pass] lint",
      "- [FAIL] test",
      "- [FAIL] deploy",
      "",
      "Failed jobs: test, deploy. Run `gh run view 200 --log-failed` to see failure logs.",
    ].join("\n");
    expect(output).toBe(expected);
  });

  test("formats CI run with single failed job", () => {
    const result: CIResult = {
      runId: 300,
      conclusion: "failure",
      jobs: [{ name: "build", conclusion: "failure" }],
    };
    const output = formatCIResult(BRANCH, result);
    const expected = [
      "[CI Watch] Branch `feature/test-branch` — CI FAILED (run 300)",
      "",
      "- [FAIL] build",
      "",
      "Failed jobs: build. Run `gh run view 300 --log-failed` to see failure logs.",
    ].join("\n");
    expect(output).toBe(expected);
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
      stdout: {
        toString: () => branch ?? "",
      },
    }));
    if (!globalThis.Bun) {
      (globalThis as Record<string, unknown>).Bun = {};
    }
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
    const run = getHookRun();
    const result = run(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.defer).not.toHaveBeenCalled();
    expect(result).toStrictEqual({ type: "success" });
  });

  test("returns success for git status", () => {
    const ctx = createMockContext("git status");
    const run = getHookRun();
    run(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.defer).not.toHaveBeenCalled();
  });

  test("returns success for git commit", () => {
    const ctx = createMockContext("git commit -m 'fix bug'");
    const run = getHookRun();
    run(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
  });

  test("returns success when getCurrentBranch returns null", () => {
    mockBunSpawnSync(null);
    const ctx = createMockContext("git push origin main");
    const run = getHookRun();
    run(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.defer).not.toHaveBeenCalled();
  });

  test("returns success when getCurrentBranch returns HEAD (detached)", () => {
    mockBunSpawnSync("HEAD");
    const ctx = createMockContext("git push origin main");
    const run = getHookRun();
    run(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.defer).not.toHaveBeenCalled();
  });

  test("calls defer when git push detected on a valid branch", () => {
    mockBunSpawnSync("feature/my-branch");
    const ctx = createMockContext("git push origin main");
    const run = getHookRun();
    run(ctx);
    expect(ctx.defer).toHaveBeenCalled();
    expect(ctx.success).not.toHaveBeenCalled();
  });
});

describe("waitForRun", () => {
  function mockBunSpawn(stdout: string) {
    const mockSpawn = vi.fn(() => ({
      exited: Promise.resolve(0),
      stdout: new Blob([stdout]).stream(),
    }));
    if (!globalThis.Bun) {
      (globalThis as Record<string, unknown>).Bun = {};
    }
    (globalThis.Bun as Record<string, unknown>).spawn = mockSpawn;
    (globalThis.Bun as Record<string, unknown>).sleep = vi.fn(() => Promise.resolve());
    return mockSpawn;
  }

  test("returns run ID when gh run list finds a run", async () => {
    mockBunSpawn(JSON.stringify([{ databaseId: 12345 }]));
    const result = await waitForRun("main");
    expect(result).toBe(12345);
  });

  test("returns null when no runs found after retries", async () => {
    mockBunSpawn(JSON.stringify([]));
    const result = await waitForRun("main");
    expect(result).toBeNull();
  });

  test("returns null when gh output is invalid JSON", async () => {
    mockBunSpawn("not json");
    const result = await waitForRun("main");
    expect(result).toBeNull();
  });
});

describe("watchCI", () => {
  function setupBunMocks(runListOutput: string, viewOutput: string) {
    let callCount = 0;
    const mockSpawn = vi.fn(() => {
      callCount++;
      // First call: waitForRun's gh run list
      // Second call: gh run watch
      // Third call: gh run view
      const output = callCount === 1 ? runListOutput : callCount === 3 ? viewOutput : "";
      return {
        exited: Promise.resolve(0),
        stdout: callCount === 2 ? "ignore" : new Blob([output]).stream(),
        stderr: new Blob([""]).stream(),
      };
    });
    if (!globalThis.Bun) {
      (globalThis as Record<string, unknown>).Bun = {};
    }
    (globalThis.Bun as Record<string, unknown>).spawn = mockSpawn;
    (globalThis.Bun as Record<string, unknown>).sleep = vi.fn(() => Promise.resolve());
    return mockSpawn;
  }

  test("returns full CI result with jobs", async () => {
    setupBunMocks(
      JSON.stringify([{ databaseId: 42 }]),
      JSON.stringify({
        conclusion: "success",
        jobs: [{ name: "lint", conclusion: "success" }],
      }),
    );
    const result = await watchCI("main");
    expect(result.runId).toBe(42);
    expect(result.conclusion).toBe("success");
    expect(result.jobs).toStrictEqual([{ name: "lint", conclusion: "success" }]);
  });

  test("returns null conclusion when view output is invalid", async () => {
    setupBunMocks(JSON.stringify([{ databaseId: 42 }]), "not json");
    const result = await watchCI("main");
    expect(result.runId).toBe(42);
    expect(result.conclusion).toBeNull();
    expect(result.jobs).toStrictEqual([]);
  });

  test("returns empty result when no runs found", async () => {
    setupBunMocks(JSON.stringify([]), "");
    const result = await watchCI("main");
    expect(result.runId).toBeNull();
    expect(result.conclusion).toBeNull();
    expect(result.jobs).toStrictEqual([]);
  });
});
