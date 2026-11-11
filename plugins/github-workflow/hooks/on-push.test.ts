import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

const { capturedHookDefs, mockExecFileSync, mockListRuns, mockListJobs } = vi.hoisted(() => ({
  capturedHookDefs: [] as { run: (ctx: unknown) => unknown }[],
  mockExecFileSync: vi.fn<(...args: unknown[]) => string>(),
  mockListRuns: vi.fn(),
  mockListJobs: vi.fn(),
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

vi.mock("node:child_process", () => ({
  execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
}));

vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn(function () {
    return {
      actions: {
        listWorkflowRunsForRepo: mockListRuns,
        listJobsForWorkflowRun: mockListJobs,
      },
    };
  }),
}));

import { type CIWatchResult, formatCIResult, getRepoInfo, watchCI } from "./entry/on-push.ts";

const CONFLICT_TREE = [
  "changed in both",
  "  base   100644 abc1234 src/index.ts",
  "  our    100644 def5678 src/index.ts",
  "  their  100644 ghi9012 src/index.ts",
  "+<<<<<<< .our",
  " code",
  "+>>>>>>> .their",
  "",
].join("\n");

function mockGit(options: { branch?: string; conflict?: boolean; pr?: boolean }) {
  mockExecFileSync.mockImplementation((...callArgs) => {
    const cmd = callArgs[0];
    const args: readonly unknown[] = Array.isArray(callArgs[1]) ? callArgs[1] : [];
    if (cmd === "git") {
      if (args[0] === "symbolic-ref") {
        if (!options.branch) throw new Error("detached");
        return options.branch;
      }
      if (args[0] === "rev-parse" && args[1] === "HEAD") return "abcdef1234567";
      if (args[0] === "remote") return "git@github.com:owner/repo.git";
      if (args[0] === "merge-base") return "base123";
      if (args[0] === "merge-tree") return options.conflict ? CONFLICT_TREE : "clean";
      return "";
    }
    if (cmd === "gh") {
      if (args[0] === "pr") {
        if (!options.pr) throw new Error("no PR");
        return "main";
      }
      if (args[0] === "auth") return "token";
    }
    return "";
  });
}

function createMockContext(command: string) {
  return {
    input: { tool_input: { command } },
    success: vi.fn(() => ({ type: "success" })),
    json: vi.fn((value: unknown) => value),
  };
}

function getHookRun() {
  const hookDef = capturedHookDefs[0];
  if (!hookDef) throw new Error("Hook not captured");
  return hookDef.run;
}

const noSleep = () => Promise.resolve();

function additionalContextOf(ctx: ReturnType<typeof createMockContext>): string {
  const payload: unknown = ctx.json.mock.calls[0]?.[0];
  if (payload === undefined) throw new Error("json was not called");
  const additionalContext: unknown = expectRecord(
    expectRecord(expectRecord(payload).output).hookSpecificOutput,
  ).additionalContext;
  if (typeof additionalContext !== "string") throw new Error("additionalContext is not a string");
  return additionalContext;
}

function expectRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`expected an object: ${JSON.stringify(value)}`);
  }
  return Object.fromEntries(Object.entries(value));
}

function mockCompletedRun() {
  mockListRuns.mockResolvedValue({
    data: { workflow_runs: [{ id: 1, name: "CI", status: "completed", conclusion: "success" }] },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env["GITHUB_TOKEN"];
});

describe("hook run", () => {
  test("ignores commands other than git push", async () => {
    const ctx = createMockContext("git pull origin main");
    await getHookRun()(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.json).not.toHaveBeenCalled();
  });

  test("skips on detached HEAD", async () => {
    mockGit({});
    const ctx = createMockContext("git push");
    await getHookRun()(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.json).not.toHaveBeenCalled();
  });

  test("reports a conflicting PR once without watching CI", async () => {
    mockGit({ branch: "feature/x", pr: true, conflict: true });
    const ctx = createMockContext("git push");
    await getHookRun()(ctx);
    expect(mockListRuns).not.toHaveBeenCalled();
    const message = additionalContextOf(ctx);
    expect(message).toContain("feature/x → main");
    expect(message).toContain("src/index.ts");
    expect(message).toContain("CI は起動しない");
  });

  // hook は hooks.json で async 実行されるので、CI の完了を待ってから結果を 1 回だけ返す
  test("waits for CI and returns the result once when the PR has no conflicts", async () => {
    mockGit({ branch: "feature/x", pr: true, conflict: false });
    mockCompletedRun();
    const ctx = createMockContext("git push -u origin feature/x");
    await getHookRun()(ctx);
    expect(ctx.json).toHaveBeenCalledTimes(1);
    expect(additionalContextOf(ctx)).toContain("失敗 0 / 成功 1");
  });

  test("waits for CI when no PR exists", async () => {
    mockGit({ branch: "feature/x", pr: false });
    mockCompletedRun();
    const ctx = createMockContext("git push");
    await getHookRun()(ctx);
    expect(additionalContextOf(ctx)).toContain("[pass] CI (run 1)");
  });
});

describe("watchCI", () => {
  test("waits for all runs of the pushed SHA and lists failed jobs", async () => {
    mockGit({ branch: "feature/x" });
    mockListRuns
      .mockResolvedValueOnce({ data: { workflow_runs: [] } })
      .mockResolvedValueOnce({
        data: {
          workflow_runs: [
            { id: 1, name: "CI", status: "in_progress", conclusion: null },
            { id: 2, name: "Release", status: "completed", conclusion: "success" },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          workflow_runs: [
            { id: 1, name: "CI", status: "completed", conclusion: "failure" },
            { id: 2, name: "Release", status: "completed", conclusion: "success" },
          ],
        },
      });
    mockListJobs.mockResolvedValue({
      data: {
        jobs: [
          { name: "lint", conclusion: "success" },
          { name: "test", conclusion: "failure" },
        ],
      },
    });

    const result = await watchCI("feature/x", "abcdef1234567", noSleep);

    expect(mockListRuns).toHaveBeenCalledWith(
      expect.objectContaining({ head_sha: "abcdef1234567", branch: "feature/x" }),
    );
    expect(result.timedOut).toBe(false);
    expect(result.runs).toStrictEqual([
      { id: 1, name: "CI", status: "completed", conclusion: "failure", failedJobs: ["test"] },
      { id: 2, name: "Release", status: "completed", conclusion: "success", failedJobs: [] },
    ]);
  });

  test("returns no runs when none appear", async () => {
    mockGit({ branch: "feature/x" });
    mockListRuns.mockResolvedValue({ data: { workflow_runs: [] } });
    const result = await watchCI("feature/x", "abcdef1234567", noSleep);
    expect(result.runs).toStrictEqual([]);
  });
});

describe("formatCIResult", () => {
  const base: CIWatchResult = { headSha: "abcdef1234567", runs: [], timedOut: false };

  test("reports missing runs", () => {
    expect(formatCIResult("feature/x", base)).toBe(
      "[CI] feature/x (abcdef1): push 後に workflow run が見つからない",
    );
  });

  test("summarizes runs and points to debug-gha on failure", () => {
    const message = formatCIResult("feature/x", {
      ...base,
      runs: [
        { id: 1, name: "CI", status: "completed", conclusion: "failure", failedJobs: ["test"] },
        { id: 2, name: "Release", status: "completed", conclusion: "success", failedJobs: [] },
        { id: 3, name: "Docs", status: "completed", conclusion: "skipped", failedJobs: [] },
      ],
    });
    expect(message).toBe(
      [
        "[CI] feature/x (abcdef1): 失敗 1 / 成功 1 / その他 1",
        "- [FAIL] CI (run 1): test",
        "- [pass] Release (run 2)",
        "- [skipped] Docs (run 3)",
        "[CI] 失敗した run のフルログ取得手順: github-workflow:debug-gha",
      ].join("\n"),
    );
  });

  test("notes runs still in progress at the watch limit", () => {
    const message = formatCIResult("feature/x", {
      ...base,
      timedOut: true,
      runs: [{ id: 1, name: "CI", status: "in_progress", conclusion: null, failedJobs: [] }],
    });
    expect(message).toContain("- [in_progress] CI (run 1)");
    expect(message).toContain("未完了の run がある");
  });

  test("appends a conflict that appeared during CI", () => {
    const message = formatCIResult(
      "feature/x",
      {
        ...base,
        runs: [{ id: 1, name: "CI", status: "completed", conclusion: "success", failedJobs: [] }],
      },
      { baseBranch: "main", hasConflicts: true, conflictFiles: ["a.ts"] },
    );
    expect(message).toContain("feature/x → main");
    expect(message).toContain("a.ts");
  });
});

describe("getRepoInfo", () => {
  test("parses https and ssh remotes", () => {
    expect(getRepoInfo("https://github.com/owner/repo.git\n")).toStrictEqual({
      owner: "owner",
      repo: "repo",
    });
    expect(getRepoInfo("git@github.com:owner/repo")).toStrictEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  test("returns null for an unparsable remote", () => {
    expect(getRepoInfo("")).toBeNull();
  });
});
