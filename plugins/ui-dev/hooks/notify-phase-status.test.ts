import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

// cc-plugin-lib のバレルは bun:sqlite を import しており vitest では読めないため、
// HookLogger と wrapRun をモックする（obsidian の hook テストと同じ規約）。
vi.mock("@r_masseater/cc-plugin-lib", () => ({
  HookLogger: {
    fromFile: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      [Symbol.dispose]: vi.fn(),
    }),
  },
  wrapRun: vi.fn((_logger: unknown, fn: unknown) => fn),
}));
// defineHook に渡された run を捕捉して直接呼ぶ。
const { capturedHookDefs } = vi.hoisted(() => ({
  capturedHookDefs: [] as { run: (ctx: unknown) => unknown }[],
}));
vi.mock("cc-hooks-ts", () => ({
  defineHook: vi.fn((opts: { run: (ctx: unknown) => unknown }) => {
    capturedHookDefs.push(opts);
    return opts;
  }),
  runHook: vi.fn(),
}));

import { buildImplementMessage, findFlowsInProgress } from "./entry/notify-phase-status.ts";

function makeContext() {
  return {
    input: {},
    success: vi.fn().mockReturnValue({ type: "success" }),
    json: vi.fn().mockReturnValue({ type: "json" }),
  };
}

describe("buildImplementMessage", () => {
  test("includes flow name, screens and the resume command", () => {
    const result = buildImplementMessage("registration", ["signup", "email-verify"]);
    expect(result).toContain('"registration"');
    expect(result).toContain("signup, email-verify");
    expect(result).toContain("/ui-dev:figma-implement registration");
  });
});

describe("notify-phase-status hook", () => {
  let testTmpDir: string;

  function writeConfig(flowName: string, content: unknown): void {
    const dir = join(testTmpDir, ".agents", "ui-dev", flowName);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "config.json"),
      typeof content === "string" ? content : JSON.stringify(content),
    );
  }

  beforeEach(() => {
    testTmpDir = join(
      tmpdir(),
      `notify-phase-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(join(testTmpDir, ".git"), { recursive: true });
    vi.spyOn(process, "cwd").mockReturnValue(testTmpDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(testTmpDir, { recursive: true, force: true });
  });

  test("returns success when no config exists", () => {
    const ctx = makeContext();
    capturedHookDefs[0]!.run(ctx);
    expect(ctx.success).toHaveBeenCalled();
    expect(ctx.json).not.toHaveBeenCalled();
  });

  test("returns success when every flow is done", () => {
    writeConfig("my-flow", { flow: { name: "my-flow", currentPhase: "done", screens: ["a"] } });
    const ctx = makeContext();
    capturedHookDefs[0]!.run(ctx);
    expect(ctx.success).toHaveBeenCalled();
    expect(ctx.json).not.toHaveBeenCalled();
  });

  test("shows a systemMessage (not reason) for the flow in progress, skipping done flows", () => {
    writeConfig("a-done", { flow: { name: "a-done", currentPhase: "done", screens: ["x"] } });
    writeConfig("registration", {
      flow: { name: "registration", currentPhase: "implement", screens: ["signup", "verify"] },
    });
    const ctx = makeContext();
    capturedHookDefs[0]!.run(ctx);

    expect(ctx.json).toHaveBeenCalledTimes(1);
    const call: unknown = ctx.json.mock.calls[0]?.[0];
    expect(call).toMatchObject({
      event: "Stop",
      output: { systemMessage: buildImplementMessage("registration", ["signup", "verify"]) },
    });
    expect(call).not.toHaveProperty("output.reason");
    expect(call).not.toHaveProperty("output.decision");
  });

  test("skips unreadable configs instead of failing", () => {
    writeConfig("broken", "{not json");
    writeConfig("ok", { flow: { name: "ok", currentPhase: "implement", screens: ["s"] } });
    expect(findFlowsInProgress().map((f) => f.name)).toEqual(["ok"]);
  });
});
