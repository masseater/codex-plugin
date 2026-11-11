import { describe, expect, test, vi } from "vite-plus/test";
import { type CapturedHook, hookContext } from "../__tests__/hook-context.ts";

vi.mock("@r_masseater/cc-plugin-lib", () => ({
  HookLogger: {
    fromFile: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      [Symbol.dispose]: vi.fn(),
    }),
  },
  wrapRun: vi.fn((_logger: unknown, fn: unknown) => fn),
}));
const captured = vi.hoisted(() => ({ hook: undefined as CapturedHook | undefined }));
vi.mock("cc-hooks-ts", () => ({
  defineHook: vi.fn((opts: CapturedHook) => {
    captured.hook = opts;
    return opts;
  }),
  runHook: vi.fn(),
}));

import { isHuskyBypassCommand } from "./entry/block-husky-bypass.ts";

describe("isHuskyBypassCommand", () => {
  test("matches 'HUSKY=0 git commit'", () => {
    expect(isHuskyBypassCommand("HUSKY=0 git commit")).toBe(true);
  });

  test("matches 'HUSKY =0 foo' (whitespace before =)", () => {
    expect(isHuskyBypassCommand("HUSKY =0 foo")).toBe(true);
  });

  test("matches 'HUSKY = 0 foo' (whitespace around =)", () => {
    expect(isHuskyBypassCommand("HUSKY = 0 foo")).toBe(true);
  });

  test("matches when embedded mid-command", () => {
    expect(isHuskyBypassCommand("git commit -m x && HUSKY=0 git push")).toBe(true);
  });

  test("does not match 'HUSKY=1'", () => {
    expect(isHuskyBypassCommand("HUSKY=1 git commit")).toBe(false);
  });

  test("does not match 'FOO_HUSKY=0 bar' (no word boundary before HUSKY)", () => {
    expect(isHuskyBypassCommand("FOO_HUSKY=0 bar")).toBe(false);
  });

  test("does not match unrelated commands", () => {
    expect(isHuskyBypassCommand("git commit -m 'fix bug'")).toBe(false);
  });

  test("does not match empty string", () => {
    expect(isHuskyBypassCommand("")).toBe(false);
  });
});

describe("hook run", () => {
  const run = (toolInput: { command?: string } | undefined) =>
    captured.hook?.run(
      hookContext(toolInput === undefined ? undefined : { tool_input: toolInput }),
    );

  test("passes when there is no input", () => {
    expect(run(undefined)).toEqual({ kind: "success", output: {} });
  });

  test("passes when the command is missing", () => {
    expect(run({})).toEqual({ kind: "success", output: {} });
  });

  test("passes a normal command", () => {
    expect(run({ command: "git commit -m x" })).toEqual({ kind: "success", output: {} });
  });

  test("denies a HUSKY=0 command", () => {
    expect(run({ command: "HUSKY=0 git commit" })).toMatchObject({
      kind: "json",
      output: {
        event: "PreToolUse",
        output: { hookSpecificOutput: { permissionDecision: "deny" } },
      },
    });
  });
});
