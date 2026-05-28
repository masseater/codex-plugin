import { describe, expect, test, vi } from "vitest";

const { capturedHookDefs, mockExecFileSync, mockSpawnSync, mockSpawn } = vi.hoisted(() => ({
  capturedHookDefs: [] as { run: (ctx: unknown) => unknown }[],
  mockExecFileSync: vi.fn<(...args: unknown[]) => string>(),
  mockSpawnSync: vi.fn(),
  mockSpawn: vi.fn(),
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

// Mock Bun global
const originalBun = globalThis.Bun;

function mockBunGlobal(overrides: { spawnSync?: typeof mockSpawnSync; spawn?: typeof mockSpawn }) {
  Object.assign(globalThis, {
    Bun: {
      ...originalBun,
      spawnSync: overrides.spawnSync ?? mockSpawnSync,
      spawn: overrides.spawn ?? mockSpawn,
    },
  });
}

import "./entry/auto-create-pr.ts";

describe("auto-create-pr hook", () => {
  function createMockContext(command: string) {
    const successResult = { type: "success" };
    let deferFn: (() => Promise<unknown>) | null = null;
    return {
      input: { tool_input: { command } },
      success: vi.fn(() => successResult),
      defer: vi.fn((fn: () => Promise<unknown>) => {
        deferFn = fn;
        return { type: "defer" };
      }),
      getDeferFn: () => deferFn,
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
    expect(result).toStrictEqual({ type: "success" });
  });

  test("returns success when branch is unavailable", () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error("not a git repo");
    });

    const ctx = createMockContext("git push origin main");
    const run = getHookRun();
    run(ctx);

    expect(ctx.success).toHaveBeenCalledWith({});
  });

  test("returns success when on default branch", () => {
    mockExecFileSync.mockImplementation((command, args) => {
      const commandName = command as string;
      const commandArgs = args as string[];
      if (commandName === "git" && commandArgs[0] === "symbolic-ref") return "main";
      return "";
    });
    mockSpawnSync.mockReturnValue({
      stdout: { toString: () => "main" },
      stderr: { toString: () => "" },
    });

    mockBunGlobal({ spawnSync: mockSpawnSync });

    const ctx = createMockContext("git push");
    const run = getHookRun();
    run(ctx);

    expect(ctx.success).toHaveBeenCalledWith({});
  });

  test("returns success when PR already exists", () => {
    mockExecFileSync.mockImplementation((command, args) => {
      const commandName = command as string;
      const commandArgs = args as string[];
      if (commandName === "git" && commandArgs[0] === "symbolic-ref") return "feature/test";
      return "";
    });
    mockSpawnSync
      .mockReturnValueOnce({
        // getDefaultBranch
        stdout: { toString: () => "main" },
        stderr: { toString: () => "" },
      })
      .mockReturnValueOnce({
        // prExists
        exitCode: 0,
        stdout: { toString: () => '{"number":42}' },
        stderr: { toString: () => "" },
      });

    mockBunGlobal({ spawnSync: mockSpawnSync });

    const ctx = createMockContext("git push origin feature/test");
    const run = getHookRun();
    run(ctx);

    expect(ctx.success).toHaveBeenCalledWith({});
  });

  test("defers PR creation when no PR exists", () => {
    mockExecFileSync.mockImplementation((command, args) => {
      const commandName = command as string;
      const commandArgs = args as string[];
      if (commandName === "git" && commandArgs[0] === "symbolic-ref") return "feature/new";
      return "";
    });
    mockSpawnSync
      .mockReturnValueOnce({
        // getDefaultBranch
        stdout: { toString: () => "main" },
        stderr: { toString: () => "" },
      })
      .mockReturnValueOnce({
        // prExists - no PR
        exitCode: 1,
        stdout: { toString: () => "" },
        stderr: { toString: () => "no pull requests found" },
      });

    mockBunGlobal({ spawnSync: mockSpawnSync });

    const ctx = createMockContext("git push origin feature/new");
    const run = getHookRun();
    const result = run(ctx);

    expect(result).toStrictEqual({ type: "defer" });
    expect(ctx.defer).toHaveBeenCalled();
  });

  test("deferred function reports successful PR creation", async () => {
    mockExecFileSync.mockImplementation((command, args) => {
      const commandName = command as string;
      const commandArgs = args as string[];
      if (commandName === "git" && commandArgs[0] === "symbolic-ref") return "feature/new";
      return "";
    });
    mockSpawnSync
      .mockReturnValueOnce({
        stdout: { toString: () => "main" },
        stderr: { toString: () => "" },
      })
      .mockReturnValueOnce({
        exitCode: 1,
        stdout: { toString: () => "" },
        stderr: { toString: () => "no pull requests found" },
      });

    const createReadableStream = (text: string) =>
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(text));
          controller.close();
        },
      });

    mockSpawn
      .mockReturnValueOnce({
        // gh pr create
        exited: Promise.resolve(0),
        exitCode: 0,
        stdout: createReadableStream("https://github.com/owner/repo/pull/1"),
        stderr: createReadableStream(""),
      })
      .mockReturnValueOnce({
        // gh pr view
        exited: Promise.resolve(0),
        exitCode: 0,
        stdout: createReadableStream("Add new feature"),
        stderr: createReadableStream(""),
      });

    mockBunGlobal({ spawnSync: mockSpawnSync, spawn: mockSpawn });

    const ctx = createMockContext("git push origin feature/new");
    const run = getHookRun();
    run(ctx);

    const deferFn = ctx.getDeferFn();
    expect(deferFn).not.toBeNull();

    const result = (await deferFn!()) as {
      output: { hookSpecificOutput: { additionalContext: string } };
    };

    expect(result.output.hookSpecificOutput.additionalContext).toContain(
      "[PR Auto-Create] Created PR",
    );
    expect(result.output.hookSpecificOutput.additionalContext).toContain(
      "https://github.com/owner/repo/pull/1",
    );
    expect(result.output.hookSpecificOutput.additionalContext).toContain("Add new feature");
  });

  test("deferred function reports failed PR creation", async () => {
    mockExecFileSync.mockImplementation((command, args) => {
      const commandName = command as string;
      const commandArgs = args as string[];
      if (commandName === "git" && commandArgs[0] === "symbolic-ref") return "feature/fail";
      return "";
    });
    mockSpawnSync
      .mockReturnValueOnce({
        stdout: { toString: () => "main" },
        stderr: { toString: () => "" },
      })
      .mockReturnValueOnce({
        exitCode: 1,
        stdout: { toString: () => "" },
        stderr: { toString: () => "no pull requests found" },
      });

    const createReadableStream = (text: string) =>
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(text));
          controller.close();
        },
      });

    mockSpawn.mockReturnValueOnce({
      exited: Promise.resolve(1),
      exitCode: 1,
      stdout: createReadableStream(""),
      stderr: createReadableStream("pull request create failed"),
    });

    mockBunGlobal({ spawnSync: mockSpawnSync, spawn: mockSpawn });

    const ctx = createMockContext("git push origin feature/fail");
    const run = getHookRun();
    run(ctx);

    const deferFn = ctx.getDeferFn();
    const result = (await deferFn!()) as {
      output: { hookSpecificOutput: { additionalContext: string } };
    };

    expect(result.output.hookSpecificOutput.additionalContext).toContain(
      "[PR Auto-Create] Failed to create PR",
    );
    expect(result.output.hookSpecificOutput.additionalContext).toContain(
      "pull request create failed",
    );
  });
});
