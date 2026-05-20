import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test as base, describe, expect, vi } from "vitest";

const { capturedHookDef } = vi.hoisted(() => ({
  capturedHookDef: [] as { run: (ctx: unknown) => unknown }[],
}));

vi.mock("@r_masseater/cc-plugin-lib", () => ({
  HookLogger: {
    fromFile: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      fatal: vi.fn(),
      [Symbol.dispose]: vi.fn(),
    }),
  },
  wrapRun: vi.fn((_logger: unknown, fn: unknown) => fn),
}));

vi.mock("cc-hooks-ts", () => ({
  defineHook: vi.fn((def: { run: (ctx: unknown) => unknown }) => {
    capturedHookDef.push(def);
    return def;
  }),
  runHook: vi.fn(),
}));

import {
  PLANNER_PROMPT,
  readPersona,
  resolveStateFile,
  WORKER_PROMPT,
  writePersona,
} from "./lib/state.ts";

await import("./entry/inject-persona.ts");
await import("./entry/announce-persona.ts");
await import("./entry/on-exit-plan.ts");
await import("./entry/cleanup-persona.ts");

const HOOK_NAMES = ["inject", "announce", "onExitPlan", "cleanup"] as const;
const hookIndex = Object.fromEntries(HOOK_NAMES.map((n, i) => [n, i])) as Record<
  (typeof HOOK_NAMES)[number],
  number
>;

const test = base.extend<{ projectDir: string; sessionId: string }>({
  projectDir: async ({ task: _task }, use) => {
    const dir = join(tmpdir(), `persona-entry-test-${Date.now()}-${Math.random()}`);
    mkdirSync(dir, { recursive: true });
    const original = process.env.CLAUDE_PROJECT_DIR;
    process.env.CLAUDE_PROJECT_DIR = dir;
    await use(dir);
    if (original === undefined) delete process.env.CLAUDE_PROJECT_DIR;
    else process.env.CLAUDE_PROJECT_DIR = original;
    rmSync(dir, { recursive: true, force: true });
  },
  // biome-ignore lint/correctness/useHookAtTopLevel: vitest fixture
  sessionId: async ({ task: _task }, use) => {
    await use(`sess-${Math.random().toString(36).slice(2)}`);
  },
});

type MockJsonResult = { type: "json"; arg: unknown };
type MockSuccessResult = { type: "success"; arg: unknown };
const createCtx = (sessionId: string) => {
  const calls: { json: unknown[]; success: unknown[] } = { json: [], success: [] };
  return {
    input: { session_id: sessionId },
    json: vi.fn((arg: unknown) => {
      calls.json.push(arg);
      return { type: "json", arg } satisfies MockJsonResult;
    }),
    success: vi.fn((arg: unknown) => {
      calls.success.push(arg);
      return { type: "success", arg } satisfies MockSuccessResult;
    }),
    calls,
  };
};

const getRun = (name: keyof typeof hookIndex) => {
  const def = capturedHookDef[hookIndex[name]];
  if (!def) throw new Error(`hook ${name} not captured`);
  return def.run as (ctx: ReturnType<typeof createCtx>) => unknown;
};

describe("inject-persona hook", () => {
  test("no-op when state file does not exist", ({ projectDir: _projectDir, sessionId }) => {
    const ctx = createCtx(sessionId);
    getRun("inject")(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.json).not.toHaveBeenCalled();
  });

  test("injects PLANNER_PROMPT when state is planner", ({ projectDir, sessionId }) => {
    writePersona(resolveStateFile(projectDir, sessionId), "planner");
    const ctx = createCtx(sessionId);
    getRun("inject")(ctx);
    expect(ctx.json).toHaveBeenCalledWith({
      event: "UserPromptSubmit",
      output: {
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: PLANNER_PROMPT,
        },
        suppressOutput: true,
      },
    });
  });

  test("injects WORKER_PROMPT when state is worker", ({ projectDir, sessionId }) => {
    writePersona(resolveStateFile(projectDir, sessionId), "worker");
    const ctx = createCtx(sessionId);
    getRun("inject")(ctx);
    const arg = ctx.calls.json[0] as {
      output: { hookSpecificOutput: { additionalContext: string } };
    };
    expect(arg.output.hookSpecificOutput.additionalContext).toBe(WORKER_PROMPT);
  });

  test("no-op when CLAUDE_PROJECT_DIR is unset", ({ sessionId }) => {
    const original = process.env.CLAUDE_PROJECT_DIR;
    delete process.env.CLAUDE_PROJECT_DIR;
    try {
      const ctx = createCtx(sessionId);
      getRun("inject")(ctx);
      expect(ctx.success).toHaveBeenCalledWith({});
    } finally {
      if (original !== undefined) process.env.CLAUDE_PROJECT_DIR = original;
    }
  });
});

describe("announce-persona hook", () => {
  test("no-op when state file does not exist", ({ projectDir: _projectDir, sessionId }) => {
    const ctx = createCtx(sessionId);
    getRun("announce")(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
  });

  test("emits systemMessage when state is set", ({ projectDir, sessionId }) => {
    writePersona(resolveStateFile(projectDir, sessionId), "planner");
    const ctx = createCtx(sessionId);
    getRun("announce")(ctx);
    expect(ctx.json).toHaveBeenCalledWith({
      event: "SessionStart",
      output: {
        systemMessage: "現在のペルソナ: planner",
        suppressOutput: true,
      },
    });
  });

  test("no-op when CLAUDE_PROJECT_DIR is unset", ({ sessionId }) => {
    const original = process.env.CLAUDE_PROJECT_DIR;
    delete process.env.CLAUDE_PROJECT_DIR;
    try {
      const ctx = createCtx(sessionId);
      getRun("announce")(ctx);
      expect(ctx.success).toHaveBeenCalledWith({});
    } finally {
      if (original !== undefined) process.env.CLAUDE_PROJECT_DIR = original;
    }
  });
});

describe("on-exit-plan hook", () => {
  test("writes worker state and emits notification", ({ projectDir, sessionId }) => {
    const stateFile = resolveStateFile(projectDir, sessionId);
    const ctx = createCtx(sessionId);
    getRun("onExitPlan")(ctx);

    expect(readPersona(stateFile)).toBe("worker");
    expect(ctx.json).toHaveBeenCalledWith({
      event: "PostToolUse",
      output: {
        systemMessage: "✓ plan承認を検知。ペルソナを worker に切り替えました",
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: WORKER_PROMPT,
        },
        suppressOutput: true,
      },
    });
  });

  test("overwrites planner state with worker", ({ projectDir, sessionId }) => {
    const stateFile = resolveStateFile(projectDir, sessionId);
    writePersona(stateFile, "planner");
    const ctx = createCtx(sessionId);
    getRun("onExitPlan")(ctx);
    expect(readPersona(stateFile)).toBe("worker");
  });

  test("no-op when CLAUDE_PROJECT_DIR is unset", ({ sessionId }) => {
    const original = process.env.CLAUDE_PROJECT_DIR;
    delete process.env.CLAUDE_PROJECT_DIR;
    try {
      const ctx = createCtx(sessionId);
      getRun("onExitPlan")(ctx);
      expect(ctx.success).toHaveBeenCalledWith({});
    } finally {
      if (original !== undefined) process.env.CLAUDE_PROJECT_DIR = original;
    }
  });
});

describe("cleanup-persona hook", () => {
  test("removes existing state file", ({ projectDir, sessionId }) => {
    const stateFile = resolveStateFile(projectDir, sessionId);
    writePersona(stateFile, "planner");
    expect(existsSync(stateFile)).toBe(true);

    const ctx = createCtx(sessionId);
    getRun("cleanup")(ctx);

    expect(existsSync(stateFile)).toBe(false);
    expect(ctx.success).toHaveBeenCalledWith({});
  });

  test("no-op when state file does not exist", ({ projectDir: _projectDir, sessionId }) => {
    const ctx = createCtx(sessionId);
    expect(() => getRun("cleanup")(ctx)).not.toThrow();
    expect(ctx.success).toHaveBeenCalledWith({});
  });

  test("no-op when CLAUDE_PROJECT_DIR is unset", ({ sessionId }) => {
    const original = process.env.CLAUDE_PROJECT_DIR;
    delete process.env.CLAUDE_PROJECT_DIR;
    try {
      const ctx = createCtx(sessionId);
      getRun("cleanup")(ctx);
      expect(ctx.success).toHaveBeenCalledWith({});
    } finally {
      if (original !== undefined) process.env.CLAUDE_PROJECT_DIR = original;
    }
  });
});
