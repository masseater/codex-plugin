import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test as base, describe, expect, vi } from "vite-plus/test";

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
  type Persona,
  personaPrompt,
  readInjectedPersona,
  readPersona,
  resolveStateFile,
  writePersona,
} from "./lib/state.ts";

// 登録されている全 persona（state.ts の定義と同じ順）
const PERSONAS: readonly Persona[] = [
  "planner",
  "worker",
  "idealist",
  "orchestrator",
  "sparring",
  "pathfinder",
];

await import("./entry/inject-persona.ts");
await import("./entry/announce-persona.ts");
await import("./entry/on-exit-plan.ts");
await import("./entry/cleanup-persona.ts");

const HOOK_NAMES = ["inject", "announce", "onExitPlan", "cleanup"] as const;
const hookIndex = (name: (typeof HOOK_NAMES)[number]): number => HOOK_NAMES.indexOf(name);

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
    input: { session_id: sessionId, source: "startup" },
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

const getRun = (name: (typeof HOOK_NAMES)[number]) => {
  const def = capturedHookDef[hookIndex(name)];
  if (!def) throw new Error(`hook ${name} not captured`);
  return def.run as (ctx: ReturnType<typeof createCtx>) => unknown;
};

const unsetProjectDir = (fn: () => void) => {
  const original = process.env.CLAUDE_PROJECT_DIR;
  delete process.env.CLAUDE_PROJECT_DIR;
  try {
    fn();
  } finally {
    if (original !== undefined) process.env.CLAUDE_PROJECT_DIR = original;
  }
};

describe("inject-persona hook", () => {
  test("no-op when state file does not exist", ({ projectDir: _projectDir, sessionId }) => {
    const ctx = createCtx(sessionId);
    getRun("inject")(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.json).not.toHaveBeenCalled();
  });

  test("injects planner prompt on the first prompt after switching", ({
    projectDir,
    sessionId,
  }) => {
    const stateFile = resolveStateFile(projectDir, sessionId);
    writePersona(stateFile, "planner");
    const ctx = createCtx(sessionId);
    getRun("inject")(ctx);
    expect(ctx.json).toHaveBeenCalledWith({
      event: "UserPromptSubmit",
      output: {
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: personaPrompt("planner"),
        },
      },
    });
    expect(readInjectedPersona(stateFile)).toBe("planner");
  });

  for (const persona of PERSONAS) {
    test(`injects ${persona} prompt when state is ${persona}`, ({ projectDir, sessionId }) => {
      writePersona(resolveStateFile(projectDir, sessionId), persona);
      const ctx = createCtx(sessionId);
      getRun("inject")(ctx);
      expect(ctx.calls.json[0]).toMatchObject({
        output: { hookSpecificOutput: { additionalContext: personaPrompt(persona) } },
      });
    });
  }

  test("skips injection while the persona is unchanged", ({ projectDir, sessionId }) => {
    writePersona(resolveStateFile(projectDir, sessionId), "worker");
    getRun("inject")(createCtx(sessionId));

    const second = createCtx(sessionId);
    getRun("inject")(second);
    expect(second.json).not.toHaveBeenCalled();
    expect(second.success).toHaveBeenCalledWith({});
  });

  test("injects again after the persona changes", ({ projectDir, sessionId }) => {
    const stateFile = resolveStateFile(projectDir, sessionId);
    writePersona(stateFile, "planner");
    getRun("inject")(createCtx(sessionId));

    writePersona(stateFile, "sparring");
    const ctx = createCtx(sessionId);
    getRun("inject")(ctx);
    expect(ctx.calls.json[0]).toMatchObject({
      output: { hookSpecificOutput: { additionalContext: personaPrompt("sparring") } },
    });
  });

  test("no-op when CLAUDE_PROJECT_DIR is unset", ({ sessionId }) => {
    unsetProjectDir(() => {
      const ctx = createCtx(sessionId);
      getRun("inject")(ctx);
      expect(ctx.success).toHaveBeenCalledWith({});
    });
  });
});

describe("announce-persona hook", () => {
  test("no-op when state file does not exist", ({ projectDir: _projectDir, sessionId }) => {
    const ctx = createCtx(sessionId);
    getRun("announce")(ctx);
    expect(ctx.success).toHaveBeenCalledWith({});
  });

  test("announces and re-injects the persona when state is set", ({ projectDir, sessionId }) => {
    const stateFile = resolveStateFile(projectDir, sessionId);
    writePersona(stateFile, "planner");
    const ctx = createCtx(sessionId);
    getRun("announce")(ctx);
    expect(ctx.json).toHaveBeenCalledWith({
      event: "SessionStart",
      output: {
        systemMessage: "現在のペルソナ: planner",
        hookSpecificOutput: {
          hookEventName: "SessionStart",
          additionalContext: personaPrompt("planner"),
        },
      },
    });
    expect(readInjectedPersona(stateFile)).toBe("planner");
  });

  test("re-injects even if the persona was injected before compaction", ({
    projectDir,
    sessionId,
  }) => {
    writePersona(resolveStateFile(projectDir, sessionId), "worker");
    getRun("inject")(createCtx(sessionId));

    const ctx = createCtx(sessionId);
    getRun("announce")(ctx);
    expect(ctx.calls.json[0]).toMatchObject({
      output: { hookSpecificOutput: { additionalContext: personaPrompt("worker") } },
    });
  });

  test("no-op when CLAUDE_PROJECT_DIR is unset", ({ sessionId }) => {
    unsetProjectDir(() => {
      const ctx = createCtx(sessionId);
      getRun("announce")(ctx);
      expect(ctx.success).toHaveBeenCalledWith({});
    });
  });
});

describe("on-exit-plan hook", () => {
  test("switches planner to worker and injects the worker prompt", ({ projectDir, sessionId }) => {
    const stateFile = resolveStateFile(projectDir, sessionId);
    writePersona(stateFile, "planner");
    const ctx = createCtx(sessionId);
    getRun("onExitPlan")(ctx);

    expect(readPersona(stateFile)).toBe("worker");
    expect(readInjectedPersona(stateFile)).toBe("worker");
    expect(ctx.json).toHaveBeenCalledWith({
      event: "PostToolUse",
      output: {
        systemMessage: "✓ plan承認を検知。ペルソナを worker に切り替えました",
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: personaPrompt("worker"),
        },
      },
    });
  });

  test("does not set a persona when none is set", ({ projectDir, sessionId }) => {
    const stateFile = resolveStateFile(projectDir, sessionId);
    const ctx = createCtx(sessionId);
    getRun("onExitPlan")(ctx);

    expect(readPersona(stateFile)).toBeUndefined();
    expect(ctx.json).not.toHaveBeenCalled();
    expect(ctx.success).toHaveBeenCalledWith({});
  });

  for (const persona of PERSONAS.filter((p) => p !== "planner")) {
    test(`keeps ${persona} unchanged`, ({ projectDir, sessionId }) => {
      const stateFile = resolveStateFile(projectDir, sessionId);
      writePersona(stateFile, persona);
      const ctx = createCtx(sessionId);
      getRun("onExitPlan")(ctx);

      expect(readPersona(stateFile)).toBe(persona);
      expect(ctx.json).not.toHaveBeenCalled();
    });
  }

  test("no-op when CLAUDE_PROJECT_DIR is unset", ({ sessionId }) => {
    unsetProjectDir(() => {
      const ctx = createCtx(sessionId);
      getRun("onExitPlan")(ctx);
      expect(ctx.success).toHaveBeenCalledWith({});
    });
  });
});

describe("cleanup-persona hook", () => {
  const endCtx = (sessionId: string, reason: string) => ({
    ...createCtx(sessionId),
    input: { session_id: sessionId, source: "startup", reason },
  });

  test("removes existing state file when the session ends with /clear", ({
    projectDir,
    sessionId,
  }) => {
    const stateFile = resolveStateFile(projectDir, sessionId);
    writePersona(stateFile, "planner");
    getRun("inject")(createCtx(sessionId));
    expect(existsSync(stateFile)).toBe(true);

    const ctx = endCtx(sessionId, "clear");
    getRun("cleanup")(ctx);

    expect(existsSync(stateFile)).toBe(false);
    expect(readInjectedPersona(stateFile)).toBeUndefined();
    expect(ctx.success).toHaveBeenCalledWith({});
  });

  test.for(["prompt_input_exit", "resume", "logout", "other"])(
    "keeps state for a resumable end (%s)",
    (reason, { projectDir, sessionId }) => {
      const stateFile = resolveStateFile(projectDir, sessionId);
      writePersona(stateFile, "worker");
      getRun("inject")(createCtx(sessionId));

      const ctx = endCtx(sessionId, reason);
      getRun("cleanup")(ctx);

      expect(readPersona(stateFile)).toBe("worker");
      expect(readInjectedPersona(stateFile)).toBe("worker");
      expect(ctx.success).toHaveBeenCalledWith({});
    },
  );

  test("no-op when state file does not exist", ({ projectDir: _projectDir, sessionId }) => {
    const ctx = endCtx(sessionId, "clear");
    expect(() => getRun("cleanup")(ctx)).not.toThrow();
    expect(ctx.success).toHaveBeenCalledWith({});
  });

  test("no-op when CLAUDE_PROJECT_DIR is unset", ({ sessionId }) => {
    unsetProjectDir(() => {
      const ctx = endCtx(sessionId, "clear");
      getRun("cleanup")(ctx);
      expect(ctx.success).toHaveBeenCalledWith({});
    });
  });
});
