import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, test, vi } from "vite-plus/test";

const { capturedHookDefs, mockExecFileSync } = vi.hoisted(() => ({
  capturedHookDefs: [] as { run: (ctx: unknown) => unknown }[],
  mockExecFileSync: vi.fn<(...args: unknown[]) => string>(),
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

import {
  type BranchState,
  formatBranchState,
  parseMergeTreeOutput,
  parseRevListCount,
  stateKey,
} from "./entry/check-branch-status.ts";

describe("parseRevListCount", () => {
  test("parses ahead and behind counts", () => {
    expect(parseRevListCount("3\t5")).toStrictEqual({ ahead: 5, behind: 3 });
  });

  test("parses zero counts", () => {
    expect(parseRevListCount("0\t0")).toStrictEqual({ ahead: 0, behind: 0 });
  });

  test("parses only ahead", () => {
    expect(parseRevListCount("0\t7")).toStrictEqual({ ahead: 7, behind: 0 });
  });

  test("parses only behind", () => {
    expect(parseRevListCount("4\t0")).toStrictEqual({ ahead: 0, behind: 4 });
  });

  test("parses large counts", () => {
    expect(parseRevListCount("100\t200")).toStrictEqual({ ahead: 200, behind: 100 });
  });
});

describe("parseMergeTreeOutput", () => {
  test("returns no conflicts for clean merge-tree output", () => {
    const output = "merged result without conflicts";
    expect(parseMergeTreeOutput(output)).toStrictEqual({
      hasConflicts: false,
      conflictFiles: [],
    });
  });

  test("returns no conflicts for empty output", () => {
    expect(parseMergeTreeOutput("")).toStrictEqual({
      hasConflicts: false,
      conflictFiles: [],
    });
  });

  test("detects conflicts from merge-tree output", () => {
    const output = [
      "changed in both",
      "  base   100644 abc1234 src/file.ts",
      "  our    100644 def5678 src/file.ts",
      "  their  100644 ghi9012 src/file.ts",
      "@@ -1,3 +1,7 @@",
      "+<<<<<<< .our",
      " some code",
      "+=======",
      " other code",
      "+>>>>>>> .their",
      "",
    ].join("\n");
    const result = parseMergeTreeOutput(output);
    expect(result.hasConflicts).toBe(true);
    expect(result.conflictFiles).toContain("src/file.ts");
  });

  test("detects multiple conflict files", () => {
    const output = [
      "changed in both",
      "  base   100644 abc1234 src/a.ts",
      "  our    100644 def5678 src/a.ts",
      "  their  100644 ghi9012 src/a.ts",
      "+<<<<<<< .our",
      " code",
      "+>>>>>>> .their",
      "changed in both",
      "  base   100644 abc1234 src/b.ts",
      "  our    100644 def5678 src/b.ts",
      "  their  100644 ghi9012 src/b.ts",
      "+<<<<<<< .our",
      " code",
      "+>>>>>>> .their",
      "",
    ].join("\n");
    const result = parseMergeTreeOutput(output);
    expect(result.hasConflicts).toBe(true);
    expect(result.conflictFiles).toStrictEqual(["src/a.ts", "src/b.ts"]);
  });

  test("returns empty conflictFiles when conflict marker found but no file pattern match", () => {
    // Has conflict marker but no "changed in both" block
    const output = "+<<<<<<< .our\nsome content\n+>>>>>>> .their\n";
    const result = parseMergeTreeOutput(output);
    expect(result.hasConflicts).toBe(true);
    expect(result.conflictFiles).toStrictEqual([]);
  });
});

describe("stateKey", () => {
  const base: BranchState = {
    branch: "feature/x",
    upstream: "origin/feature/x",
    ahead: 1,
    behind: 0,
    conflict: undefined,
  };

  test("ignores changes in the number of commits", () => {
    expect(stateKey({ ...base, ahead: 5 })).toBe(stateKey(base));
  });

  test("changes when the branch becomes up to date or conflicting", () => {
    expect(stateKey({ ...base, ahead: 0 })).not.toBe(stateKey(base));
    expect(stateKey({ ...base, conflict: { baseBranch: "main", files: [] } })).not.toBe(
      stateKey(base),
    );
  });
});

describe("formatBranchState", () => {
  test("states missing upstream", () => {
    expect(
      formatBranchState({
        branch: "feature/x",
        upstream: undefined,
        ahead: 0,
        behind: 0,
        conflict: undefined,
      }),
    ).toStrictEqual(["[git] feature/x: upstream 未設定（未 push）"]);
  });

  test("states ahead, behind and conflict as facts", () => {
    expect(
      formatBranchState({
        branch: "feature/x",
        upstream: "origin/feature/x",
        ahead: 3,
        behind: 2,
        conflict: { baseBranch: "main", files: ["src/index.ts"] },
      }),
    ).toStrictEqual([
      "[git] feature/x: origin/feature/x より 3 コミット先行（未 push）",
      "[git] feature/x: origin/feature/x より 2 コミット遅れている（未取り込み）",
      "[git] PR（feature/x → main）が base と conflict している: src/index.ts。解消するまで pull_request トリガーの CI は起動しない。",
    ]);
  });
});

describe("hook run", () => {
  type HookResult = {
    output: { systemMessage?: string };
  };

  const stateHome = mkdtempSync(join(tmpdir(), "branch-status-test-"));
  process.env["XDG_STATE_HOME"] = stateHome;
  let sessionCounter = 0;

  afterAll(() => {
    rmSync(stateHome, { recursive: true, force: true });
  });

  beforeEach(() => {
    mockExecFileSync.mockReset();
    sessionCounter += 1;
  });

  function createMockContext(sessionId = `session-${sessionCounter}`) {
    return {
      input: { stop_hook_active: false, session_id: sessionId },
      success: vi.fn(() => ({ output: {} })),
      json: vi.fn((payload: HookResult) => payload),
    };
  }

  function getHookRun() {
    const hookDef = capturedHookDefs[0];
    if (!hookDef) throw new Error("Hook not captured");
    return hookDef.run;
  }

  function mockRepo(options: {
    branch?: string;
    upstream?: string;
    revList?: string;
    prBase?: string;
    mergeTree?: string;
  }) {
    mockExecFileSync.mockImplementation((...callArgs) => {
      const cmd = callArgs[0];
      const args: readonly unknown[] = Array.isArray(callArgs[1]) ? callArgs[1] : [];
      if (cmd === "git") {
        if (args[0] === "rev-parse" && args[1] === "--is-inside-work-tree") return "true";
        if (args[0] === "symbolic-ref") {
          if (!options.branch) throw new Error("detached HEAD");
          return options.branch;
        }
        if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") {
          if (!options.upstream) throw new Error("no upstream");
          return options.upstream;
        }
        if (args[0] === "rev-list") return options.revList ?? "0\t0";
        if (args[0] === "merge-base") return "abc123";
        if (args[0] === "merge-tree") return options.mergeTree ?? "clean merge output";
        return "";
      }
      if (cmd === "gh") {
        if (!options.prBase) throw new Error("no PR");
        return options.prBase;
      }
      return "";
    });
  }

  // hook は hooks.json で async 実行され、結果の JSON を 1 回だけ返す
  async function runStop(ctx: ReturnType<typeof createMockContext>): Promise<HookResult> {
    await getHookRun()(ctx);
    // json を呼ばずに success で終えた場合は、success の戻り値と同じ空の出力として扱う
    return ctx.json.mock.calls[0]?.[0] ?? { output: {} };
  }

  test("skips when stop_hook_active is true", () => {
    const ctx = createMockContext();
    ctx.input.stop_hook_active = true;
    getHookRun()(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.json).not.toHaveBeenCalled();
  });

  test("skips when not a git repository", () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error("not a git repo");
    });
    const ctx = createMockContext();
    getHookRun()(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.json).not.toHaveBeenCalled();
  });

  test("skips on detached HEAD", () => {
    mockRepo({});
    const ctx = createMockContext();
    getHookRun()(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.json).not.toHaveBeenCalled();
  });

  test("reports missing upstream", async () => {
    mockRepo({ branch: "feature/test" });
    const result = await runStop(createMockContext());
    expect(result.output.systemMessage).toContain("upstream 未設定");
  });

  test("stays silent when the branch is up to date", async () => {
    mockRepo({ branch: "main", upstream: "origin/main" });
    const result = await runStop(createMockContext());
    expect(result.output.systemMessage).toBeUndefined();
  });

  test("reports ahead once and stays silent until the state changes", async () => {
    mockRepo({ branch: "feature/x", upstream: "origin/feature/x", revList: "0\t3" });
    const first = await runStop(createMockContext("same-session"));
    expect(first.output.systemMessage).toContain("3 コミット先行");

    mockRepo({ branch: "feature/x", upstream: "origin/feature/x", revList: "0\t4" });
    const second = await runStop(createMockContext("same-session"));
    expect(second.output.systemMessage).toBeUndefined();

    mockRepo({ branch: "feature/x", upstream: "origin/feature/x", revList: "0\t0" });
    await runStop(createMockContext("same-session"));
    mockRepo({ branch: "feature/x", upstream: "origin/feature/x", revList: "0\t1" });
    const fourth = await runStop(createMockContext("same-session"));
    expect(fourth.output.systemMessage).toContain("1 コミット先行");
  });

  test("reports behind without pulling", async () => {
    mockRepo({ branch: "feature/x", upstream: "origin/feature/x", revList: "2\t0" });
    const result = await runStop(createMockContext());
    expect(result.output.systemMessage).toContain("2 コミット遅れている");
    const pulled = mockExecFileSync.mock.calls.some(
      (call) => call[0] === "git" && Array.isArray(call[1]) && call[1][0] === "pull",
    );
    expect(pulled).toBe(false);
  });

  test("reports conflicts with the PR base branch", async () => {
    mockRepo({
      branch: "feature/x",
      upstream: "origin/feature/x",
      prBase: "main",
      mergeTree: [
        "changed in both",
        "  base   100644 abc1234 src/index.ts",
        "  our    100644 def5678 src/index.ts",
        "  their  100644 ghi9012 src/index.ts",
        "+<<<<<<< .our",
        " code",
        "+>>>>>>> .their",
        "",
      ].join("\n"),
    });
    const result = await runStop(createMockContext());
    expect(result.output.systemMessage).toContain("feature/x → main");
    expect(result.output.systemMessage).toContain("src/index.ts");
  });

  test("stays silent when the PR has no conflicts", async () => {
    mockRepo({ branch: "feature/x", upstream: "origin/feature/x", prBase: "main" });
    const result = await runStop(createMockContext());
    expect(result.output.systemMessage).toBeUndefined();
  });
});
