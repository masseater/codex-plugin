import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";

// Tests for the pure logic and hook run function in vault-lint.ts.
// cc-plugin-lib and cc-hooks-ts are mocked because the real cc-plugin-lib
// barrel transitively imports bun:sqlite (via MutilsDB), which is
// unavailable under vitest's Node/Vite runtime (same convention as
// ccs-symlink-check.test.ts).

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
// 直接呼び出してテストできるようにする（ccs-symlink-check.test.ts と同じ規約）。
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
// getVaultPath() は os.homedir() から都度 Vault のパスを組み立てるため、
// モックしないと実際のホームディレクトリの Vault を参照してしまう。
const { homedirState } = vi.hoisted(() => ({ homedirState: { current: "" } }));
vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return {
    ...actual,
    default: { ...actual, homedir: () => homedirState.current },
    homedir: () => homedirState.current,
  };
});

import { extractWikilinks, getAllNotes } from "./entry/vault-lint.ts";

const tmpDirs: string[] = [];

function createTmpDir(): string {
  const dir = path.join(
    tmpdir(),
    `obsidian-vault-lint-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  tmpDirs.push(dir);
  return dir;
}

function setHome(): { home: string; vaultPath: string } {
  const home = createTmpDir();
  homedirState.current = home;
  return { home, vaultPath: path.join(home, "Documents", "Zettelkasten") };
}

afterEach(() => {
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

describe("extractWikilinks", () => {
  test("extracts multiple wikilinks from content", () => {
    const content = "See [[Note A]] and also [[Note B]] for details.";
    expect(extractWikilinks(content)).toEqual(["Note A", "Note B"]);
  });

  test("extracts the note name from an aliased wikilink", () => {
    const content = "Check [[Actual Note|display alias]] here.";
    expect(extractWikilinks(content)).toEqual(["Actual Note"]);
  });

  test("returns an empty array when there are no wikilinks", () => {
    const content = "This is plain text with no links at all.";
    expect(extractWikilinks(content)).toEqual([]);
  });

  test("returns duplicate links as-is without deduplication", () => {
    const content = "[[Note A]] appears twice: [[Note A]].";
    expect(extractWikilinks(content)).toEqual(["Note A", "Note A"]);
  });
});

describe("getAllNotes", () => {
  test("returns an empty set when the vault directory does not exist", () => {
    setHome();

    expect(getAllNotes()).toEqual(new Set());
  });

  test("collects .md file names (without extension) from non-dot subdirectories", () => {
    const { vaultPath } = setHome();
    mkdirSync(path.join(vaultPath, "zettel"), { recursive: true });
    writeFileSync(path.join(vaultPath, "zettel", "Note A.md"), "content");
    writeFileSync(path.join(vaultPath, "zettel", "Note B.md"), "content");

    expect(getAllNotes()).toEqual(new Set(["Note A", "Note B"]));
  });

  test("ignores non-.md files within subdirectories", () => {
    const { vaultPath } = setHome();
    mkdirSync(path.join(vaultPath, "zettel"), { recursive: true });
    writeFileSync(path.join(vaultPath, "zettel", "Note A.md"), "content");
    writeFileSync(path.join(vaultPath, "zettel", "attachment.png"), "binary");

    expect(getAllNotes()).toEqual(new Set(["Note A"]));
  });

  test("skips dot-prefixed directories (e.g. .obsidian)", () => {
    const { vaultPath } = setHome();
    mkdirSync(path.join(vaultPath, ".obsidian"), { recursive: true });
    writeFileSync(path.join(vaultPath, ".obsidian", "config.md"), "content");
    mkdirSync(path.join(vaultPath, "zettel"), { recursive: true });
    writeFileSync(path.join(vaultPath, "zettel", "Note A.md"), "content");

    expect(getAllNotes()).toEqual(new Set(["Note A"]));
  });

  test("skips top-level entries that are not directories", () => {
    const { vaultPath } = setHome();
    mkdirSync(vaultPath, { recursive: true });
    writeFileSync(path.join(vaultPath, "loose-file.md"), "content");
    mkdirSync(path.join(vaultPath, "zettel"), { recursive: true });
    writeFileSync(path.join(vaultPath, "zettel", "Note A.md"), "content");

    expect(getAllNotes()).toEqual(new Set(["Note A"]));
  });
});

function makeContext(filePath: string | undefined) {
  return {
    input: {
      tool_input: filePath === undefined ? {} : { file_path: filePath },
    },
    success: vi.fn().mockReturnValue({ type: "success" }),
    blockingError: vi.fn().mockReturnValue({ type: "blockingError" }),
  };
}

describe("hook run function", () => {
  test("capturedHookDefs is populated after module import", () => {
    expect(capturedHookDefs.length).toBeGreaterThan(0);
  });

  test("returns success when tool_input has no file_path", () => {
    setHome();
    const ctx = makeContext(undefined);

    capturedHookDefs[0]!.run(ctx);

    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.blockingError).not.toHaveBeenCalled();
  });

  test("returns success when the file is outside the vault", () => {
    const { home } = setHome();
    const outsidePath = path.join(home, "elsewhere", "Note.md");
    const ctx = makeContext(outsidePath);

    capturedHookDefs[0]!.run(ctx);

    expect(ctx.success).toHaveBeenCalledWith({});
  });

  test("returns success when the file is inside the vault but is not markdown", () => {
    const { vaultPath } = setHome();
    mkdirSync(vaultPath, { recursive: true });
    const filePath = path.join(vaultPath, "attachment.png");
    writeFileSync(filePath, "binary");
    const ctx = makeContext(filePath);

    capturedHookDefs[0]!.run(ctx);

    expect(ctx.success).toHaveBeenCalledWith({});
  });

  test("expands a ~/ prefix and returns success when the resolved file does not exist", () => {
    setHome();
    const ctx = makeContext("~/Documents/Zettelkasten/missing.md");

    capturedHookDefs[0]!.run(ctx);

    expect(ctx.success).toHaveBeenCalledWith({});
  });

  test("returns success when the markdown file has no wikilinks", () => {
    const { vaultPath } = setHome();
    mkdirSync(vaultPath, { recursive: true });
    const filePath = path.join(vaultPath, "Note.md");
    writeFileSync(filePath, "Plain content with no links.");
    const ctx = makeContext(filePath);

    capturedHookDefs[0]!.run(ctx);

    expect(ctx.success).toHaveBeenCalledWith({});
  });

  test("returns success when all wikilinks resolve to existing notes", () => {
    const { vaultPath } = setHome();
    mkdirSync(path.join(vaultPath, "zettel"), { recursive: true });
    writeFileSync(path.join(vaultPath, "zettel", "Target.md"), "target content");
    const filePath = path.join(vaultPath, "zettel", "Source.md");
    writeFileSync(filePath, "See [[Target]] for details.");
    const ctx = makeContext(filePath);

    capturedHookDefs[0]!.run(ctx);

    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.blockingError).not.toHaveBeenCalled();
  });

  test("blocks with a formatted error when wikilinks are broken", () => {
    const { vaultPath } = setHome();
    mkdirSync(path.join(vaultPath, "zettel"), { recursive: true });
    const filePath = path.join(vaultPath, "zettel", "Source.md");
    writeFileSync(filePath, "See [[Missing Note]] for details.");
    const ctx = makeContext(filePath);

    capturedHookDefs[0]!.run(ctx);

    expect(ctx.success).not.toHaveBeenCalled();
    expect(ctx.blockingError).toHaveBeenCalledTimes(1);
    const message: unknown = ctx.blockingError.mock.calls[0]?.[0];
    expect(message).toEqual(expect.any(String));
    expect(message).toContain("Source.md");
    expect(message).toContain("[[Missing Note]]");
    expect(message).toContain("1 件");
    expect(message).toContain("pre-commit hook");
  });
});
