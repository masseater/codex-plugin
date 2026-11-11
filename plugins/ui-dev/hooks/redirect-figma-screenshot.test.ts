import { existsSync } from "node:fs";
import { describe, expect, test, vi } from "vite-plus/test";

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

import { DENY_REASON, EXPORT_SCREENSHOT_SCRIPT } from "./entry/redirect-figma-screenshot.ts";

describe("redirect-figma-screenshot hook", () => {
  test("denies via hookSpecificOutput.permissionDecision instead of the deprecated top-level decision", () => {
    const ctx = { input: {}, json: vi.fn().mockReturnValue({ type: "json" }) };
    capturedHookDefs[0]!.run(ctx);

    expect(ctx.json).toHaveBeenCalledTimes(1);
    const call: unknown = ctx.json.mock.calls[0]?.[0];
    expect(call).toMatchObject({
      event: "PreToolUse",
      output: {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: DENY_REASON,
        },
      },
    });
    expect(call).not.toHaveProperty("output.decision");
  });

  test("reason contains the absolute path of an existing export-screenshot script", () => {
    expect(EXPORT_SCREENSHOT_SCRIPT).toMatch(/skills\/figma-data\/scripts\/export-screenshot\.ts$/);
    expect(existsSync(EXPORT_SCREENSHOT_SCRIPT)).toBe(true);
    expect(DENY_REASON).toContain(EXPORT_SCREENSHOT_SCRIPT);
    expect(DENY_REASON).toContain("--file-key");
    expect(DENY_REASON).toContain("--node-id");
    expect(DENY_REASON).toContain("--output");
  });
});
