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

// Import triggers module-level code (defineHook, etc.)
await import("./entry/log-git-status.ts");

function createMockContext(stopHookActive: boolean) {
  const successResult = { type: "success" };
  return {
    input: { stop_hook_active: stopHookActive },
    success: vi.fn(() => successResult),
  };
}

function getHookRun() {
  const hookDef = capturedHookDefs[0];
  if (!hookDef) throw new Error("Hook not captured");
  return hookDef.run;
}

describe("hook run", () => {
  test("skips when stop_hook_active is true", () => {
    const ctx = createMockContext(true);
    const run = getHookRun();
    run(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
  });

  test("skips when not a git repository", () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error("not a git repo");
    });
    const ctx = createMockContext(false);
    const run = getHookRun();
    run(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
  });

  test("runs git status and diff when in a git repo", () => {
    mockExecFileSync.mockImplementation((..._args) => {
      const args = _args[1] as string[];
      if (args[0] === "rev-parse") return "true";
      if (args[0] === "status") return "On branch main\nnothing to commit";
      if (args[0] === "diff") return "";
      return "";
    });
    const ctx = createMockContext(false);
    const run = getHookRun();
    run(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
    // Verify git commands were called
    expect(mockExecFileSync).toHaveBeenCalledWith(
      "git",
      ["rev-parse", "--is-inside-work-tree"],
      expect.any(Object),
    );
    expect(mockExecFileSync).toHaveBeenCalledWith("git", ["status"], expect.any(Object));
    expect(mockExecFileSync).toHaveBeenCalledWith("git", ["diff"], expect.any(Object));
  });

  test("handles non-empty git diff", () => {
    mockExecFileSync.mockImplementation((..._args) => {
      const args = _args[1] as string[];
      if (args[0] === "rev-parse") return "true";
      if (args[0] === "status") return "modified: file.ts";
      if (args[0] === "diff") return "diff --git a/file.ts\n+added line\n-removed line";
      return "";
    });
    const ctx = createMockContext(false);
    const run = getHookRun();
    run(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
  });
});
