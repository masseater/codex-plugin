import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
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

import { computeWakeupRecord, resolveWakeupFilePath } from "./entry/record-schedule-wakeup.ts";

describe("computeWakeupRecord", () => {
  test("computes fireAt as nowEpochSec + delaySeconds", () => {
    const record = computeWakeupRecord("session-1", 300, "check CI", 1_000_000);
    expect(record.fireAt).toBe(1_000_300);
  });

  test("carries through reason, delaySeconds, and sessionId unchanged", () => {
    const record = computeWakeupRecord("session-abc", 60, "poll status", 500);
    expect(record).toStrictEqual({
      fireAt: 560,
      reason: "poll status",
      delaySeconds: 60,
      sessionId: "session-abc",
    });
  });

  test("handles zero delay", () => {
    const record = computeWakeupRecord("s", 0, "immediate", 42);
    expect(record.fireAt).toBe(42);
  });
});

describe("resolveWakeupFilePath", () => {
  test("builds path with wakeup-<sessionId>.json filename", () => {
    const result = resolveWakeupFilePath("/tmp/cache", "session-42");
    expect(result).toBe("/tmp/cache/wakeup-session-42.json");
  });

  test("differs for different session ids", () => {
    const a = resolveWakeupFilePath("/tmp/cache", "session-a");
    const b = resolveWakeupFilePath("/tmp/cache", "session-b");
    expect(a).not.toBe(b);
  });
});

describe("hook run", () => {
  const dirs: string[] = [];

  function tmp(): string {
    const dir = mkdtempSync(path.join(tmpdir(), "wakeup-test-"));
    dirs.push(dir);
    return dir;
  }

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  const run = (input: Record<string, unknown>) => captured.hook?.run(hookContext(input));

  test("ignores tools other than ScheduleWakeup", () => {
    expect(run({ tool_name: "Bash" })).toEqual({ kind: "success", output: {} });
  });

  test("records the wakeup under CLAUDE_CONFIG_DIR", () => {
    const configDir = tmp();
    vi.stubEnv("CLAUDE_CONFIG_DIR", configDir);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_000_000 * 1000));

    const result = run({
      tool_name: "ScheduleWakeup",
      session_id: "s1",
      tool_input: { delaySeconds: 120, reason: "check CI" },
    });

    expect(result).toEqual({ kind: "success", output: {} });
    const file = path.join(configDir, "cache", "statusline", "wakeup-s1.json");
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({
      fireAt: 1_000_120,
      reason: "check CI",
      delaySeconds: 120,
      sessionId: "s1",
    });
  });

  test("falls back to ~/.claude and tolerates missing delay and reason", () => {
    const home = tmp();
    vi.stubEnv("CLAUDE_CONFIG_DIR", "");
    vi.stubEnv("HOME", home);

    run({ tool_name: "ScheduleWakeup", session_id: "s2", tool_input: {} });

    const file = path.join(home, ".claude", "cache", "statusline", "wakeup-s2.json");
    expect(JSON.parse(readFileSync(file, "utf8"))).toMatchObject({
      delaySeconds: 0,
      reason: "",
      sessionId: "s2",
    });
  });
});
