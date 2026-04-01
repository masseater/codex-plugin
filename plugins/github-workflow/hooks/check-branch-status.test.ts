import { describe, expect, test, vi } from "vitest";

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

import { parseRevListCount, parseMergeTreeOutput } from "./entry/check-branch-status.ts";

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

describe("hook run", () => {
  function createMockContext() {
    const successResult = { type: "success" };
    const jsonResult = { type: "json" };
    return {
      input: { stop_hook_active: false },
      success: vi.fn(() => successResult),
      json: vi.fn<(arg: { output: { reason: string } }) => typeof jsonResult>(() => jsonResult),
    };
  }

  function getHookRun() {
    const hookDef = capturedHookDefs[0];
    if (!hookDef) throw new Error("Hook not captured");
    return hookDef.run;
  }

  test("skips when stop_hook_active is true", () => {
    const ctx = createMockContext();
    ctx.input.stop_hook_active = true;
    const run = getHookRun();
    run(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.json).not.toHaveBeenCalled();
  });

  test("skips when not a git repository", () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error("not a git repo");
    });
    const ctx = createMockContext();
    const run = getHookRun();
    run(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.json).not.toHaveBeenCalled();
  });

  test("skips on detached HEAD", () => {
    mockExecFileSync.mockImplementation((..._args) => {
      const args = _args[1] as string[];
      if (args[0] === "rev-parse" && args[1] === "--is-inside-work-tree") return "true";
      if (args[0] === "symbolic-ref") throw new Error("detached HEAD");
      return "";
    });
    const ctx = createMockContext();
    const run = getHookRun();
    run(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
  });

  test("reports no remote tracking branch", () => {
    mockExecFileSync.mockImplementation((..._args) => {
      const args = _args[1] as string[];
      if (args[0] === "rev-parse" && args[1] === "--is-inside-work-tree") return "true";
      if (args[0] === "symbolic-ref") return "feature/test";
      if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") throw new Error("no upstream");
      // gh pr view
      if (args[0] === "pr") throw new Error("no PR");
      return "";
    });
    const ctx = createMockContext();
    const run = getHookRun();
    run(ctx);
    expect(ctx.json).toHaveBeenCalled();
    const jsonArg = ctx.json.mock.calls[0]![0] as { output: { reason: string } };
    expect(jsonArg.output.reason).toContain("no remote tracking branch");
  });

  test("returns success when branch is up to date", () => {
    mockExecFileSync.mockImplementation((..._args) => {
      const args = _args[1] as string[];
      if (args[0] === "rev-parse" && args[1] === "--is-inside-work-tree") return "true";
      if (args[0] === "symbolic-ref") return "main";
      if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return "origin/main";
      if (args[0] === "rev-list") return "0\t0";
      // gh pr view
      if (args[0] === "pr") throw new Error("no PR");
      return "";
    });
    const ctx = createMockContext();
    const run = getHookRun();
    run(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.json).not.toHaveBeenCalled();
  });

  test("reports ahead commits", () => {
    mockExecFileSync.mockImplementation((..._args) => {
      const args = _args[1] as string[];
      if (args[0] === "rev-parse" && args[1] === "--is-inside-work-tree") return "true";
      if (args[0] === "symbolic-ref") return "feature/x";
      if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return "origin/feature/x";
      if (args[0] === "rev-list") return "0\t3";
      if (args[0] === "pr") throw new Error("no PR");
      return "";
    });
    const ctx = createMockContext();
    const run = getHookRun();
    run(ctx);
    expect(ctx.json).toHaveBeenCalled();
    const jsonArg = ctx.json.mock.calls[0]![0] as { output: { reason: string } };
    expect(jsonArg.output.reason).toContain("3 commit(s) ahead");
  });

  test("reports behind commits", () => {
    mockExecFileSync.mockImplementation((..._args) => {
      const args = _args[1] as string[];
      if (args[0] === "rev-parse" && args[1] === "--is-inside-work-tree") return "true";
      if (args[0] === "symbolic-ref") return "feature/x";
      if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return "origin/feature/x";
      if (args[0] === "rev-list") return "2\t0";
      if (args[0] === "pr") throw new Error("no PR");
      return "";
    });
    const ctx = createMockContext();
    const run = getHookRun();
    run(ctx);
    expect(ctx.json).toHaveBeenCalled();
    const jsonArg = ctx.json.mock.calls[0]![0] as { output: { reason: string } };
    expect(jsonArg.output.reason).toContain("2 commit(s) behind");
  });

  test("reports merge conflicts with PR base branch", () => {
    const conflictMergeTree = [
      "changed in both",
      "  base   100644 abc1234 src/index.ts",
      "  our    100644 def5678 src/index.ts",
      "  their  100644 ghi9012 src/index.ts",
      "+<<<<<<< .our",
      " code",
      "+>>>>>>> .their",
      "",
    ].join("\n");
    mockExecFileSync.mockImplementation((..._args) => {
      const cmd = _args[0];
      const args = _args[1] as string[];
      if (cmd === "git") {
        if (args[0] === "rev-parse" && args[1] === "--is-inside-work-tree") return "true";
        if (args[0] === "symbolic-ref") return "feature/x";
        if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return "origin/feature/x";
        if (args[0] === "rev-list") return "0\t0";
        if (args[0] === "fetch") return "";
        if (args[0] === "merge-base") return "abc123";
        if (args[0] === "merge-tree") return conflictMergeTree;
      }
      if (cmd === "gh") return "main";
      return "";
    });
    const ctx = createMockContext();
    const run = getHookRun();
    run(ctx);
    expect(ctx.json).toHaveBeenCalled();
    const jsonArg = ctx.json.mock.calls[0]![0] as { output: { reason: string } };
    expect(jsonArg.output.reason).toContain("merge conflicts");
    expect(jsonArg.output.reason).toContain("src/index.ts");
  });

  test("reports no conflicts with PR base branch", () => {
    mockExecFileSync.mockImplementation((..._args) => {
      const cmd = _args[0];
      const args = _args[1] as string[];
      if (cmd === "git") {
        if (args[0] === "rev-parse" && args[1] === "--is-inside-work-tree") return "true";
        if (args[0] === "symbolic-ref") return "feature/x";
        if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return "origin/feature/x";
        if (args[0] === "rev-list") return "0\t0";
        if (args[0] === "fetch") return "";
        if (args[0] === "merge-base") return "abc123";
        if (args[0] === "merge-tree") return "clean merge output";
      }
      if (cmd === "gh") return "main";
      return "";
    });
    const ctx = createMockContext();
    const run = getHookRun();
    run(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.json).not.toHaveBeenCalled();
  });
});
