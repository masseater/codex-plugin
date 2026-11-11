import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { type CapturedHook, hookContext } from "../__tests__/hook-context.ts";
import { mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

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

import { buildWarning, findInstallRoot, findLockRoot } from "./entry/check-install.ts";

function createTmpDir(): string {
  const dir = path.join(
    tmpdir(),
    `check-install-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

const tmpDirs: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

describe("findInstallRoot", () => {
  test("finds root directory containing node_modules/.bun directly", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);
    mkdirSync(path.join(dir, "node_modules", ".bun"), { recursive: true });

    expect(findInstallRoot(dir)).toBe(dir);
  });

  test("walks up ancestors to find node_modules/.bun", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);
    mkdirSync(path.join(dir, "node_modules", ".bun"), { recursive: true });
    const nested = path.join(dir, "plugins", "mutils", "hooks");
    mkdirSync(nested, { recursive: true });

    expect(findInstallRoot(nested)).toBe(dir);
  });

  test("returns null when no ancestor has node_modules/.bun", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);
    const nested = path.join(dir, "no-install-here");
    mkdirSync(nested, { recursive: true });

    expect(findInstallRoot(nested)).toBeNull();
  });
});

describe("findLockRoot", () => {
  test("finds root directory containing bun.lock directly", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);
    writeFileSync(path.join(dir, "bun.lock"), "");

    expect(findLockRoot(dir)).toBe(dir);
  });

  test("walks up ancestors to find bun.lock", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);
    writeFileSync(path.join(dir, "bun.lock"), "");
    const nested = path.join(dir, "plugins", "mutils", "hooks");
    mkdirSync(nested, { recursive: true });

    expect(findLockRoot(nested)).toBe(dir);
  });

  test("returns null when no ancestor has bun.lock", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);
    const nested = path.join(dir, "no-lock-here");
    mkdirSync(nested, { recursive: true });

    expect(findLockRoot(nested)).toBeNull();
  });
});

describe("buildWarning", () => {
  test("includes root and reason in the message", () => {
    const message = buildWarning("/some/root", "node_modules/.bun is missing");
    expect(message).toContain("/some/root");
    expect(message).toContain("node_modules/.bun is missing");
  });

  test("includes the setup instruction", () => {
    const message = buildWarning("/some/root", "bun.lock is newer than node_modules");
    expect(message).toContain("/mutils:setup");
  });
});

describe("hook run", () => {
  const run = () => captured.hook?.run(hookContext({}));
  const success = { kind: "success", output: {} };

  function makeProject(): string {
    const dir = createTmpDir();
    tmpDirs.push(dir);
    vi.stubEnv("CLAUDE_PLUGIN_ROOT", dir);
    return dir;
  }

  test("skips when CLAUDE_PLUGIN_ROOT is not set", () => {
    vi.stubEnv("CLAUDE_PLUGIN_ROOT", "");
    expect(run()).toEqual(success);
  });

  test("skips when no bun.lock exists in ancestors", () => {
    makeProject();
    expect(run()).toEqual(success);
  });

  test("warns when node_modules/.bun is missing", () => {
    const dir = makeProject();
    writeFileSync(path.join(dir, "bun.lock"), "");
    expect(run()).toEqual({
      kind: "json",
      output: {
        event: "SessionStart",
        output: { systemMessage: buildWarning(dir, "node_modules/.bun is missing") },
      },
    });
  });

  test("warns when bun.lock is newer than node_modules", () => {
    const dir = makeProject();
    mkdirSync(path.join(dir, "node_modules", ".bun"), { recursive: true });
    writeFileSync(path.join(dir, "bun.lock"), "");
    utimesSync(path.join(dir, "node_modules", ".bun"), 1000, 1000);
    utimesSync(path.join(dir, "bun.lock"), 2000, 2000);
    expect(run()).toEqual({
      kind: "json",
      output: {
        event: "SessionStart",
        output: { systemMessage: buildWarning(dir, "bun.lock is newer than node_modules") },
      },
    });
  });

  test("passes when node_modules is newer than bun.lock", () => {
    const dir = makeProject();
    mkdirSync(path.join(dir, "node_modules", ".bun"), { recursive: true });
    writeFileSync(path.join(dir, "bun.lock"), "");
    utimesSync(path.join(dir, "bun.lock"), 1000, 1000);
    utimesSync(path.join(dir, "node_modules", ".bun"), 2000, 2000);
    expect(run()).toEqual(success);
  });

  test("passes when an install exists above a lock-less plugin directory", () => {
    const dir = makeProject();
    mkdirSync(path.join(dir, "node_modules", ".bun"), { recursive: true });
    writeFileSync(path.join(dir, "bun.lock"), "");
    const nested = path.join(dir, "plugins", "p");
    mkdirSync(nested, { recursive: true });
    vi.stubEnv("CLAUDE_PLUGIN_ROOT", nested);
    utimesSync(path.join(dir, "bun.lock"), 1000, 1000);
    utimesSync(path.join(dir, "node_modules", ".bun"), 2000, 2000);
    expect(run()).toEqual(success);
  });

  test("skips the mtime check when the install root has no bun.lock", () => {
    const dir = makeProject();
    writeFileSync(path.join(dir, "bun.lock"), "");
    const nested = path.join(dir, "plugins", "p");
    mkdirSync(path.join(nested, "node_modules", ".bun"), { recursive: true });
    vi.stubEnv("CLAUDE_PLUGIN_ROOT", nested);
    expect(run()).toEqual(success);
  });
});
