import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { type CapturedHook, hookContext } from "../__tests__/hook-context.ts";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
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

import {
  buildOutdatedMessage,
  getInstalledVersion,
  getReferencedVersions,
} from "./entry/check-context-version.ts";

function createTmpDir(): string {
  const dir = path.join(
    tmpdir(),
    `check-ctx-ver-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

describe("getInstalledVersion", () => {
  test("returns null for non-existent directory", () => {
    const result = getInstalledVersion("/nonexistent-dir-99999");
    expect(result).toBeNull();
  });

  test("returns the highest version", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    mkdirSync(path.join(dir, "1.0.0"));
    mkdirSync(path.join(dir, "2.1.0"));
    mkdirSync(path.join(dir, "1.5.3"));

    const result = getInstalledVersion(dir);
    expect(result).toBe("2.1.0");
  });

  test("ignores non-semver directories", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    mkdirSync(path.join(dir, "1.0.0"));
    mkdirSync(path.join(dir, "not-a-version"));
    mkdirSync(path.join(dir, "latest"));

    const result = getInstalledVersion(dir);
    expect(result).toBe("1.0.0");
  });

  test("returns null when directory is empty", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    const result = getInstalledVersion(dir);
    expect(result).toBeNull();
  });

  test("returns null when directory has only non-semver entries", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    mkdirSync(path.join(dir, "foo"));
    mkdirSync(path.join(dir, "bar"));

    const result = getInstalledVersion(dir);
    expect(result).toBeNull();
  });
});

describe("getReferencedVersions", () => {
  const CACHE_BASE = "/fake/cache";
  const VERSION_PATTERN = `${CACHE_BASE}/masseater-plugins/mutils/`;

  test("returns empty map when no files exist", async () => {
    const result = await getReferencedVersions(["/nonexistent-file.md"], VERSION_PATTERN);
    expect(result.size).toBe(0);
  });

  test("extracts version from file content", async () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    const filePath = path.join(dir, "AGENTS.md");
    writeFileSync(filePath, `See ${CACHE_BASE}/masseater-plugins/mutils/2.0.0/skills/foo`);

    const result = await getReferencedVersions([filePath], VERSION_PATTERN);
    expect(result.size).toBe(1);
    expect(result.get(filePath)).toBe("2.0.0");
  });

  test("returns empty map when file has no version reference", async () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    const filePath = path.join(dir, "CLAUDE.md");
    writeFileSync(filePath, "No version reference here");

    const result = await getReferencedVersions([filePath], VERSION_PATTERN);
    expect(result.size).toBe(0);
  });

  test("handles multiple files with different versions", async () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    const file1 = path.join(dir, "AGENTS.md");
    const file2 = path.join(dir, "CLAUDE.md");
    writeFileSync(file1, `${CACHE_BASE}/masseater-plugins/mutils/1.0.0/skills`);
    writeFileSync(file2, `${CACHE_BASE}/masseater-plugins/mutils/2.0.0/hooks`);

    const result = await getReferencedVersions([file1, file2], VERSION_PATTERN);
    expect(result.size).toBe(2);
    expect(result.get(file1)).toBe("1.0.0");
    expect(result.get(file2)).toBe("2.0.0");
  });

  test("skips non-existent files in list", async () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    const existingFile = path.join(dir, "AGENTS.md");
    writeFileSync(existingFile, `${CACHE_BASE}/masseater-plugins/mutils/1.0.0/foo`);

    const result = await getReferencedVersions(["/nonexistent.md", existingFile], VERSION_PATTERN);
    expect(result.size).toBe(1);
    expect(result.get(existingFile)).toBe("1.0.0");
  });
});

describe("buildOutdatedMessage", () => {
  test("tells the user to delete the legacy reference line instead of re-running setup", () => {
    const message = buildOutdatedMessage(["- /home/u/AGENTS.md: 0.1.0 → 0.2.0"]);
    expect(message).toContain("参照行は削除してよい");
    expect(message).toContain("- /home/u/AGENTS.md: 0.1.0 → 0.2.0");
  });
});

describe("hook run", () => {
  const CACHE = ".claude/plugins/cache/masseater-plugins/mutils";

  // HOME はモジュール読み込み時に読まれるため、差し替えてから読み込み直す
  async function loadHookWithHome(): Promise<{ home: string; run: () => Promise<unknown> }> {
    const home = createTmpDir();
    tmpDirs.push(home);
    vi.stubEnv("HOME", home);
    vi.resetModules();
    await import("./entry/check-context-version.ts");
    return { home, run: async () => captured.hook?.run(hookContext({})) };
  }

  test("skips when mutils is not installed", async () => {
    const { run } = await loadHookWithHome();
    expect(await run()).toEqual({ kind: "success", output: {} });
  });

  test("passes when references match the installed version", async () => {
    const { home, run } = await loadHookWithHome();
    mkdirSync(path.join(home, CACHE, "1.2.0"), { recursive: true });
    writeFileSync(path.join(home, "AGENTS.md"), `${home}/${CACHE}/1.2.0/assets/a.md`);
    expect(await run()).toEqual({ kind: "success", output: {} });
  });

  test("warns about references to an older version", async () => {
    const { home, run } = await loadHookWithHome();
    mkdirSync(path.join(home, CACHE, "1.2.0"), { recursive: true });
    writeFileSync(path.join(home, "AGENTS.md"), `${home}/${CACHE}/1.0.0/assets/a.md`);
    expect(await run()).toEqual({
      kind: "json",
      output: {
        event: "SessionStart",
        output: {
          systemMessage: buildOutdatedMessage([`- ${home}/AGENTS.md: 1.0.0 → 1.2.0`]),
        },
      },
    });
  });
});
