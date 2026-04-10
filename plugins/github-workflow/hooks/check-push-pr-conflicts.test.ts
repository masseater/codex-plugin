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

import "./entry/check-push-pr-conflicts.ts";

describe("check-push-pr-conflicts hook", () => {
  function createMockContext(command: string) {
    const successResult = { type: "success" };
    const jsonResult = { type: "json" };
    return {
      input: { tool_input: { command } },
      success: vi.fn(() => successResult),
      json: vi.fn(() => jsonResult),
    };
  }

  function getHookRun() {
    const hookDef = capturedHookDefs[0];
    if (!hookDef) throw new Error("Hook not captured");
    return hookDef.run;
  }

  test("returns success for non-push commands", () => {
    const ctx = createMockContext("git status");
    const run = getHookRun();
    const result = run(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.json).not.toHaveBeenCalled();
    expect(result).toStrictEqual({ type: "success" });
  });

  test("returns success when no PR exists for the pushed branch", () => {
    mockExecFileSync.mockImplementation((command, args) => {
      const commandName = command as string;
      const commandArgs = args as string[];
      if (commandName === "git" && commandArgs[0] === "symbolic-ref") return "feature/test";
      if (commandName === "gh" && commandArgs[0] === "pr") throw new Error("no PR");
      return "";
    });

    const ctx = createMockContext("git push origin feature/test");
    const run = getHookRun();
    run(ctx);

    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.json).not.toHaveBeenCalled();
  });

  test("returns success when PR has no conflicts with base", () => {
    mockExecFileSync.mockImplementation((command, args) => {
      const commandName = command as string;
      const commandArgs = args as string[];
      if (commandName === "git") {
        if (commandArgs[0] === "symbolic-ref") return "feature/test";
        if (commandArgs[0] === "fetch") return "";
        if (commandArgs[0] === "merge-base") return "abc123";
        if (commandArgs[0] === "merge-tree") return "clean merge output";
      }
      if (commandName === "gh" && commandArgs[0] === "pr") return "main";
      return "";
    });

    const ctx = createMockContext("git push");
    const run = getHookRun();
    run(ctx);

    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.json).not.toHaveBeenCalled();
  });

  test("injects conflict resolution instructions when pushed branch PR conflicts with base", () => {
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

    mockExecFileSync.mockImplementation((command, args) => {
      const commandName = command as string;
      const commandArgs = args as string[];
      if (commandName === "git") {
        if (commandArgs[0] === "symbolic-ref") return "feature/test";
        if (commandArgs[0] === "fetch") return "";
        if (commandArgs[0] === "merge-base") return "abc123";
        if (commandArgs[0] === "merge-tree") return conflictMergeTree;
      }
      if (commandName === "gh" && commandArgs[0] === "pr") return "main";
      return "";
    });

    const ctx = createMockContext("git push origin feature/test");
    const run = getHookRun();
    run(ctx);

    expect(ctx.json).toHaveBeenCalled();
    const jsonCalls = ctx.json.mock.calls as unknown[][];
    const firstCall = jsonCalls[0];
    expect(firstCall).toBeDefined();
    const jsonArg = firstCall?.[0] as {
      output: { hookSpecificOutput: { additionalContext: string } };
    };
    expect(jsonArg.output.hookSpecificOutput.additionalContext).toContain(
      'already has an open PR and has merge conflicts with its base branch "main"',
    );
    expect(jsonArg.output.hookSpecificOutput.additionalContext).toContain("src/index.ts");
    expect(jsonArg.output.hookSpecificOutput.additionalContext).toContain("git merge origin/main");
  });
});
