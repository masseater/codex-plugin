import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

// cc-plugin-lib と cc-hooks-ts をモックする。
// 実際の cc-plugin-lib バレルは MutilsDB 経由で bun:sqlite を import しており、
// vitest の Node/Vite ランタイムでは読み込めないため
// （block-cross-worktree-edit.test.ts と同じ規約）。
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
// defineHook に渡された run 関数を捕捉し、トップレベルの wrapRun 本体を
// 直接呼び出してテストできるようにする（redirect-claude-md-edit.test.ts と同じ規約）。
const { capturedHookDefs } = vi.hoisted(() => {
  const defs: { run: (ctx: unknown) => unknown }[] = [];
  return { capturedHookDefs: defs };
});
vi.mock("cc-hooks-ts", () => ({
  defineHook: vi.fn((opts: { run: (ctx: unknown) => unknown }) => {
    capturedHookDefs.push(opts);
    return opts;
  }),
  runHook: vi.fn(),
}));

// os.homedir() をテスト用の一時ディレクトリに差し替える。
// ソースは os.homedir() から直接 ~/.ccs, ~/.claude を組み立てるため、
// モックしないと実際のホームディレクトリにシンボリックリンクを作成してしまう。
const { homedirState } = vi.hoisted(() => ({ homedirState: { current: "" } }));
vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return {
    ...actual,
    homedir: () => homedirState.current,
  };
});

import {
  copyDirContents,
  ensureDir,
  ensureSymlink,
  processSharedContextAccounts,
  replaceWithSymlink,
  toCcsConfig,
} from "./entry/ccs-symlink-check.ts";

const tmpDirs: string[] = [];

function createTmpDir(): string {
  const dir = path.join(
    tmpdir(),
    `ccs-symlink-check-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

describe("ensureDir", () => {
  test("creates a directory that does not exist yet", () => {
    const root = createTmpDir();
    const target = path.join(root, "nested", "dir");

    expect(existsSync(target)).toBe(false);
    ensureDir(target);

    expect(existsSync(target)).toBe(true);
    expect(lstatSync(target).isDirectory()).toBe(true);
  });

  test("is idempotent when the directory already exists", () => {
    const root = createTmpDir();
    const target = path.join(root, "existing");
    mkdirSync(target);

    expect(() => ensureDir(target)).not.toThrow();
    expect(existsSync(target)).toBe(true);
  });
});

describe("ensureSymlink", () => {
  test("returns false and leaves the link untouched when already pointing to the target", () => {
    const root = createTmpDir();
    const target = path.join(root, "target-dir");
    mkdirSync(target);
    const linkPath = path.join(root, "link");
    symlinkSync(target, linkPath);

    const result = ensureSymlink(linkPath, target);

    expect(result).toBe(false);
    expect(readlinkSync(linkPath)).toBe(target);
  });
});

describe("replaceWithSymlink", () => {
  test("replaces a plain directory with a symlink and copies its contents into the target", () => {
    const root = createTmpDir();
    const src = path.join(root, "src-dir");
    mkdirSync(src);
    writeFileSync(path.join(src, "file.txt"), "hello");
    const target = path.join(root, "target-dir");

    const result = replaceWithSymlink(src, target);

    expect(result).toBe(true);
    expect(lstatSync(src).isSymbolicLink()).toBe(true);
    expect(readlinkSync(src)).toBe(target);
    expect(readFileSync(path.join(target, "file.txt"), "utf-8")).toBe("hello");
  });

  test("returns false when src is already a symlink pointing to the target", () => {
    const root = createTmpDir();
    const target = path.join(root, "target-dir");
    mkdirSync(target);
    const src = path.join(root, "src-link");
    symlinkSync(target, src);

    const result = replaceWithSymlink(src, target);

    expect(result).toBe(false);
    expect(readlinkSync(src)).toBe(target);
  });

  test("creates a new symlink when src does not exist", () => {
    const root = createTmpDir();
    const target = path.join(root, "target-dir");
    const src = path.join(root, "nested", "src-link");

    const result = replaceWithSymlink(src, target);

    expect(result).toBe(true);
    expect(lstatSync(src).isSymbolicLink()).toBe(true);
    expect(readlinkSync(src)).toBe(target);
  });
});

describe("copyDirContents", () => {
  test("copies nested directories and files", () => {
    const root = createTmpDir();
    const src = path.join(root, "src");
    const dest = path.join(root, "dest");
    mkdirSync(path.join(src, "sub"), { recursive: true });
    mkdirSync(dest, { recursive: true });
    writeFileSync(path.join(src, "top.txt"), "top-content");
    writeFileSync(path.join(src, "sub", "nested.txt"), "nested-content");

    copyDirContents(src, dest);

    expect(readFileSync(path.join(dest, "top.txt"), "utf-8")).toBe("top-content");
    expect(readFileSync(path.join(dest, "sub", "nested.txt"), "utf-8")).toBe("nested-content");
  });

  test("skips entries that already exist in the destination", () => {
    const root = createTmpDir();
    const src = path.join(root, "src");
    const dest = path.join(root, "dest");
    mkdirSync(src, { recursive: true });
    mkdirSync(dest, { recursive: true });
    writeFileSync(path.join(src, "existing.txt"), "from-src");
    writeFileSync(path.join(dest, "existing.txt"), "from-dest");

    copyDirContents(src, dest);

    expect(readFileSync(path.join(dest, "existing.txt"), "utf-8")).toBe("from-dest");
  });
});

describe("processSharedContextAccounts", () => {
  test("skips an account whose context_mode is not shared", () => {
    const root = createTmpDir();
    const ccsDir = path.join(root, ".ccs");
    const claudeDir = path.join(root, ".claude");
    mkdirSync(path.join(ccsDir, "instances", "acct-a"), { recursive: true });

    const fixed = processSharedContextAccounts(
      { "acct-a": { context_mode: "isolated" } },
      ccsDir,
      claudeDir,
    );

    expect(fixed).toEqual([]);
    expect(existsSync(path.join(ccsDir, "shared"))).toBe(false);
  });

  test("skips a shared account whose instance directory does not exist yet", () => {
    const root = createTmpDir();
    const ccsDir = path.join(root, ".ccs");
    const claudeDir = path.join(root, ".claude");

    const fixed = processSharedContextAccounts(
      { "acct-a": { context_mode: "shared" } },
      ccsDir,
      claudeDir,
    );

    expect(fixed).toEqual([]);
    expect(existsSync(path.join(ccsDir, "shared"))).toBe(false);
  });

  test("builds the full symlink chain for a shared account using the default group", () => {
    const root = createTmpDir();
    const ccsDir = path.join(root, ".ccs");
    const claudeDir = path.join(root, ".claude");
    const instanceDir = path.join(ccsDir, "instances", "acct-a");
    mkdirSync(instanceDir, { recursive: true });
    mkdirSync(path.join(instanceDir, "projects"), { recursive: true });
    mkdirSync(path.join(instanceDir, "sessions"), { recursive: true });
    for (const dir of ["file-history", "session-env", "shell-snapshots", "todos"]) {
      mkdirSync(path.join(instanceDir, dir), { recursive: true });
    }

    const fixed = processSharedContextAccounts(
      { "acct-a": { context_mode: "shared" } },
      ccsDir,
      claudeDir,
    );

    const groupDir = path.join(ccsDir, "shared", "context-groups", "default");
    const groupProjects = path.join(groupDir, "projects");
    const claudeProjects = path.join(claudeDir, "projects");
    const claudeSessions = path.join(claudeDir, "sessions");

    // groupDir/projects -> ~/.claude/projects
    expect(lstatSync(groupProjects).isSymbolicLink()).toBe(true);
    expect(readlinkSync(groupProjects)).toBe(claudeProjects);

    // instanceDir/projects -> groupDir/projects
    expect(lstatSync(path.join(instanceDir, "projects")).isSymbolicLink()).toBe(true);
    expect(readlinkSync(path.join(instanceDir, "projects"))).toBe(groupProjects);

    // instanceDir/sessions -> ~/.claude/sessions
    expect(lstatSync(path.join(instanceDir, "sessions")).isSymbolicLink()).toBe(true);
    expect(readlinkSync(path.join(instanceDir, "sessions"))).toBe(claudeSessions);

    // continuity dirs
    for (const dir of ["file-history", "session-env", "shell-snapshots", "todos"]) {
      const target = path.join(groupDir, "continuity", dir);
      const instancePath = path.join(instanceDir, dir);
      expect(lstatSync(instancePath).isSymbolicLink()).toBe(true);
      expect(readlinkSync(instancePath)).toBe(target);
    }

    // fixed には projects の作成メッセージ・instance 側リンク・4 個の continuity リンクが含まれる
    expect(fixed).toContain(`acct-a: created ${groupProjects} -> ${claudeProjects}`);
    expect(fixed).toContain(`acct-a: ${path.join(instanceDir, "projects")} -> ${groupProjects}`);
    expect(fixed).toContain(`acct-a: ${path.join(instanceDir, "sessions")} -> ${claudeSessions}`);
    // created groupProjects(1) + instanceProjects(1) + instanceSessions(1) + continuity(4) = 7
    expect(fixed.length).toBe(7);
  });

  test("uses the explicit context_group value instead of default", () => {
    const root = createTmpDir();
    const ccsDir = path.join(root, ".ccs");
    const claudeDir = path.join(root, ".claude");
    const instanceDir = path.join(ccsDir, "instances", "acct-b");
    mkdirSync(instanceDir, { recursive: true });

    processSharedContextAccounts(
      { "acct-b": { context_mode: "shared", context_group: "team-x" } },
      ccsDir,
      claudeDir,
    );

    const groupDir = path.join(ccsDir, "shared", "context-groups", "team-x");
    expect(existsSync(groupDir)).toBe(true);
    expect(existsSync(path.join(ccsDir, "shared", "context-groups", "default"))).toBe(false);
  });

  test("is idempotent: a second run over already-linked state reports no changes", () => {
    const root = createTmpDir();
    const ccsDir = path.join(root, ".ccs");
    const claudeDir = path.join(root, ".claude");
    const instanceDir = path.join(ccsDir, "instances", "acct-a");
    mkdirSync(instanceDir, { recursive: true });
    mkdirSync(path.join(instanceDir, "projects"), { recursive: true });
    mkdirSync(path.join(instanceDir, "sessions"), { recursive: true });
    for (const dir of ["file-history", "session-env", "shell-snapshots", "todos"]) {
      mkdirSync(path.join(instanceDir, dir), { recursive: true });
    }
    const accounts = { "acct-a": { context_mode: "shared" } };

    processSharedContextAccounts(accounts, ccsDir, claudeDir);
    const fixedSecondRun = processSharedContextAccounts(accounts, ccsDir, claudeDir);

    expect(fixedSecondRun).toEqual([]);
  });

  test("only processes accounts flagged as shared out of a mixed set", () => {
    const root = createTmpDir();
    const ccsDir = path.join(root, ".ccs");
    const claudeDir = path.join(root, ".claude");
    mkdirSync(path.join(ccsDir, "instances", "acct-shared"), { recursive: true });
    mkdirSync(path.join(ccsDir, "instances", "acct-isolated"), { recursive: true });

    const fixed = processSharedContextAccounts(
      {
        "acct-shared": { context_mode: "shared" },
        "acct-isolated": { context_mode: "isolated" },
      },
      ccsDir,
      claudeDir,
    );

    expect(fixed.every((entry) => entry.startsWith("acct-shared:"))).toBe(true);
    expect(existsSync(path.join(ccsDir, "instances", "acct-isolated", "projects"))).toBe(false);
  });
});

function makeContext() {
  let result: Record<string, unknown> | undefined;
  return {
    success: vi.fn((val: unknown) => {
      result = { type: "success", value: val };
      return result;
    }),
    json: vi.fn((val: unknown) => {
      result = { type: "json", value: val };
      return result;
    }),
    getResult: () => result,
  };
}

describe("hook run function", () => {
  function setHome(): string {
    const home = createTmpDir();
    homedirState.current = home;
    return home;
  }

  test("capturedHookDefs is populated after module import", () => {
    expect(capturedHookDefs.length).toBeGreaterThan(0);
  });

  test("returns success when ~/.ccs/config.yaml does not exist", () => {
    setHome();
    const ctx = makeContext();

    capturedHookDefs[0]!.run(ctx);

    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.json).not.toHaveBeenCalled();
  });

  test("returns success when config.yaml contains invalid YAML", () => {
    const home = setHome();
    mkdirSync(path.join(home, ".ccs"), { recursive: true });
    writeFileSync(path.join(home, ".ccs", "config.yaml"), "accounts: [unterminated");
    const ctx = makeContext();

    capturedHookDefs[0]!.run(ctx);

    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.json).not.toHaveBeenCalled();
  });

  test("returns success when config.yaml has no accounts key", () => {
    const home = setHome();
    mkdirSync(path.join(home, ".ccs"), { recursive: true });
    writeFileSync(path.join(home, ".ccs", "config.yaml"), "other_key: true\n");
    const ctx = makeContext();

    capturedHookDefs[0]!.run(ctx);

    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.json).not.toHaveBeenCalled();
  });

  test("returns success when no account has context_mode shared", () => {
    const home = setHome();
    mkdirSync(path.join(home, ".ccs"), { recursive: true });
    writeFileSync(
      path.join(home, ".ccs", "config.yaml"),
      "accounts:\n  acct-a:\n    context_mode: isolated\n",
    );
    const ctx = makeContext();

    capturedHookDefs[0]!.run(ctx);

    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.json).not.toHaveBeenCalled();
  });

  test("returns json with a user-facing systemMessage when a shared account produces fixed links", () => {
    const home = setHome();
    mkdirSync(path.join(home, ".ccs", "instances", "acct-a"), { recursive: true });
    writeFileSync(
      path.join(home, ".ccs", "config.yaml"),
      "accounts:\n  acct-a:\n    context_mode: shared\n",
    );
    const ctx = makeContext();

    capturedHookDefs[0]!.run(ctx);

    expect(ctx.success).not.toHaveBeenCalled();
    expect(ctx.json).toHaveBeenCalledTimes(1);
    const call: unknown = ctx.json.mock.calls[0]?.[0];
    expect(call).toMatchObject({
      event: "SessionStart",
      output: {
        systemMessage: expect.stringMatching(
          /^CCS symlink check: fixed \d+ link\(s\):\n[\s\S]*acct-a:/,
        ),
      },
    });
    expect(call).not.toHaveProperty("output.hookSpecificOutput");
  });
});

describe("toCcsConfig", () => {
  test("keeps only string context_mode / context_group of object accounts", () => {
    expect(
      toCcsConfig({
        accounts: {
          a: { context_mode: "shared", context_group: "g", extra: 1 },
          b: { context_mode: 1 },
          c: "not-an-object",
        },
      }),
    ).toStrictEqual({ accounts: { a: { context_mode: "shared", context_group: "g" }, b: {} } });
  });

  test("returns an empty config when accounts is missing or not an object", () => {
    expect(toCcsConfig(null)).toStrictEqual({});
    expect(toCcsConfig({})).toStrictEqual({});
    expect(toCcsConfig({ accounts: "x" })).toStrictEqual({});
  });
});
