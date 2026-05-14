import { describe, expect, test, vi } from "vitest";

const { capturedHookDefs, mockExecFileSync, mockSpawnSync } = vi.hoisted(() => ({
  capturedHookDefs: [] as { run: (ctx: unknown) => unknown }[],
  mockExecFileSync: vi.fn<(...args: unknown[]) => string>(),
  mockSpawnSync: vi.fn<(...args: unknown[]) => { status: number; stdout: string; stderr: string }>(
    () => ({ status: 0, stdout: "", stderr: "" }),
  ),
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
  spawnSync: (...args: unknown[]) => mockSpawnSync(...args),
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
  type DeferredResult = {
    event: string;
    output: { systemMessage?: string };
  };

  function createMockContext() {
    const successResult = { type: "success" as const };
    let capturedHandler: (() => Promise<DeferredResult>) | null = null;

    return {
      input: { stop_hook_active: false },
      success: vi.fn(() => successResult),
      defer: vi.fn((handler: () => Promise<DeferredResult>) => {
        capturedHandler = handler;
        return { type: "deferred" as const };
      }),
      runDeferred: async (): Promise<DeferredResult> => {
        if (!capturedHandler) throw new Error("No deferred handler captured");
        return capturedHandler();
      },
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
    expect(ctx.defer).not.toHaveBeenCalled();
  });

  test("skips when not a git repository", () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error("not a git repo");
    });
    const ctx = createMockContext();
    const run = getHookRun();
    run(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.defer).not.toHaveBeenCalled();
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

  test("reports no remote tracking branch", async () => {
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
    expect(ctx.defer).toHaveBeenCalled();
    const result = await ctx.runDeferred();
    expect(result.output.systemMessage).toContain("no remote tracking branch");
  });

  test("defers with no systemMessage when branch is up to date", async () => {
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
    expect(ctx.defer).toHaveBeenCalled();
    const result = await ctx.runDeferred();
    expect(result.output.systemMessage).toBeUndefined();
  });

  test("auto-pushes when no PR exists and branch is ahead", async () => {
    mockExecFileSync.mockImplementation((..._args) => {
      const args = _args[1] as string[];
      if (args[0] === "rev-parse" && args[1] === "--is-inside-work-tree") return "true";
      if (args[0] === "symbolic-ref") return "feature/x";
      if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return "origin/feature/x";
      if (args[0] === "rev-list") return "0\t3";
      if (args[0] === "pr") throw new Error("no PR");
      return "";
    });
    mockSpawnSync.mockImplementation((..._args) => {
      const args = _args[1] as string[];
      if (args[0] === "push") return { status: 0, stdout: "", stderr: "" };
      return { status: 0, stdout: "", stderr: "" };
    });
    const ctx = createMockContext();
    const run = getHookRun();
    run(ctx);
    expect(ctx.defer).toHaveBeenCalled();
    const result = await ctx.runDeferred();
    expect(result.output.systemMessage).toContain("Auto-pushed 3 commit(s)");
  });

  test("auto-pushes when PR exists and branch is ahead", async () => {
    mockExecFileSync.mockImplementation((..._args) => {
      const cmd = _args[0];
      const args = _args[1] as string[];
      if (cmd === "git") {
        if (args[0] === "rev-parse" && args[1] === "--is-inside-work-tree") return "true";
        if (args[0] === "symbolic-ref") return "feature/x";
        if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return "origin/feature/x";
        if (args[0] === "rev-list") return "0\t3";
        if (args[0] === "fetch") return "";
        if (args[0] === "merge-base") return "abc123";
        if (args[0] === "merge-tree") return "clean merge output";
      }
      if (cmd === "gh") return "main";
      return "";
    });
    mockSpawnSync.mockImplementation((..._args) => {
      const args = _args[1] as string[];
      if (args[0] === "push") return { status: 0, stdout: "", stderr: "" };
      return { status: 0, stdout: "", stderr: "" };
    });
    const ctx = createMockContext();
    const run = getHookRun();
    run(ctx);
    expect(ctx.defer).toHaveBeenCalled();
    const result = await ctx.runDeferred();
    expect(result.output.systemMessage).toContain("Auto-pushed 3 commit(s)");
  });

  test("reports push failure via systemMessage when auto-push fails", async () => {
    mockExecFileSync.mockImplementation((..._args) => {
      const cmd = _args[0];
      const args = _args[1] as string[];
      if (cmd === "git") {
        if (args[0] === "rev-parse" && args[1] === "--is-inside-work-tree") return "true";
        if (args[0] === "symbolic-ref") return "feature/x";
        if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return "origin/feature/x";
        if (args[0] === "rev-list") return "0\t3";
        if (args[0] === "fetch") return "";
        if (args[0] === "merge-base") return "abc123";
        if (args[0] === "merge-tree") return "clean merge output";
      }
      if (cmd === "gh") return "main";
      return "";
    });
    mockSpawnSync.mockImplementation((..._args) => {
      const args = _args[1] as string[];
      if (args[0] === "push") {
        return { status: 1, stdout: "", stderr: "remote rejected" };
      }
      return { status: 0, stdout: "", stderr: "" };
    });
    const ctx = createMockContext();
    const run = getHookRun();
    run(ctx);
    expect(ctx.defer).toHaveBeenCalled();
    const result = await ctx.runDeferred();
    expect(result.output.systemMessage).toContain("Auto-push failed");
    expect(result.output.systemMessage).toContain("3 commit(s) ahead");
    expect(result.output.systemMessage).toContain("remote rejected");
  });

  test("auto-pulls when behind and notifies via systemMessage", async () => {
    mockExecFileSync.mockImplementation((..._args) => {
      const args = _args[1] as string[];
      if (args[0] === "rev-parse" && args[1] === "--is-inside-work-tree") return "true";
      if (args[0] === "symbolic-ref") return "feature/x";
      if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return "origin/feature/x";
      if (args[0] === "rev-list") return "2\t0";
      if (args[0] === "pr") throw new Error("no PR");
      return "";
    });
    mockSpawnSync.mockImplementation((..._args) => {
      const args = _args[1] as string[];
      if (args[0] === "pull") return { status: 0, stdout: "", stderr: "" };
      return { status: 0, stdout: "", stderr: "" };
    });
    const ctx = createMockContext();
    const run = getHookRun();
    run(ctx);
    expect(ctx.defer).toHaveBeenCalled();
    const result = await ctx.runDeferred();
    expect(result.output.systemMessage).toContain("Auto-pulled 2 commit(s)");
    expect(result.output.systemMessage).toContain("origin/feature/x");
  });

  test("reports pull failure via systemMessage when fast-forward is not possible", async () => {
    mockExecFileSync.mockImplementation((..._args) => {
      const args = _args[1] as string[];
      if (args[0] === "rev-parse" && args[1] === "--is-inside-work-tree") return "true";
      if (args[0] === "symbolic-ref") return "feature/x";
      if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") return "origin/feature/x";
      if (args[0] === "rev-list") return "2\t0";
      if (args[0] === "pr") throw new Error("no PR");
      return "";
    });
    mockSpawnSync.mockImplementation((..._args) => {
      const args = _args[1] as string[];
      if (args[0] === "pull") {
        return {
          status: 1,
          stdout: "",
          stderr: "fatal: Not possible to fast-forward, aborting.",
        };
      }
      return { status: 0, stdout: "", stderr: "" };
    });
    const ctx = createMockContext();
    const run = getHookRun();
    run(ctx);
    expect(ctx.defer).toHaveBeenCalled();
    const result = await ctx.runDeferred();
    expect(result.output.systemMessage).toContain("Auto-pull failed");
    expect(result.output.systemMessage).toContain("2 commit(s) behind");
    expect(result.output.systemMessage).toContain("Not possible to fast-forward");
  });

  test("reports merge conflicts with PR base branch", async () => {
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
    expect(ctx.defer).toHaveBeenCalled();
    const result = await ctx.runDeferred();
    expect(result.output.systemMessage).toContain("merge conflicts");
    expect(result.output.systemMessage).toContain("src/index.ts");
  });

  test("defers with no systemMessage when no conflicts with PR base branch", async () => {
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
    expect(ctx.defer).toHaveBeenCalled();
    const result = await ctx.runDeferred();
    expect(result.output.systemMessage).toBeUndefined();
  });
});
