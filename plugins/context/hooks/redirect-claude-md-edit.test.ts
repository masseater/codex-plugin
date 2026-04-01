import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test as base, describe, expect, vi } from "vitest";

const { capturedHookDefs } = vi.hoisted(() => {
  const capturedHookDefs: { run: (ctx: unknown) => unknown }[] = [];
  return { capturedHookDefs };
});

vi.mock("@r_masseater/cc-plugin-lib", () => ({
  HookLogger: { fromFile: () => ({ debug: vi.fn(), warn: vi.fn(), [Symbol.dispose]: vi.fn() }) },
  wrapRun: vi.fn((_logger: unknown, fn: unknown) => fn),
}));
vi.mock("cc-hooks-ts", () => ({
  defineHook: vi.fn((opts: { run: (ctx: unknown) => unknown }) => {
    capturedHookDefs.push(opts);
    return opts;
  }),
  runHook: vi.fn(),
}));

import { isRegularFile } from "./entry/redirect-claude-md-edit.js";

const test = base.extend<{ tempDir: string }>({
  tempDir: async ({}, use) => {
    const dir = join(tmpdir(), `redirect-hook-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    await use(dir);
    rmSync(dir, { recursive: true, force: true });
  },
});

describe("isRegularFile", () => {
  test("returns true for a regular file", ({ tempDir }) => {
    const filePath = join(tempDir, "CLAUDE.md");
    writeFileSync(filePath, "# content");

    expect(isRegularFile(filePath)).toBe(true);
  });

  test("returns false for a symlink", ({ tempDir }) => {
    const targetPath = join(tempDir, "AGENTS.md");
    const linkPath = join(tempDir, "CLAUDE.md");
    writeFileSync(targetPath, "# AGENTS");
    symlinkSync(targetPath, linkPath);

    expect(isRegularFile(linkPath)).toBe(false);
  });

  test("returns false for a non-existent path", ({ tempDir }) => {
    const filePath = join(tempDir, "nonexistent.md");

    expect(isRegularFile(filePath)).toBe(false);
  });

  test("returns false for a directory", ({ tempDir }) => {
    const dirPath = join(tempDir, "subdir");
    mkdirSync(dirPath);

    expect(isRegularFile(dirPath)).toBe(false);
  });
});

describe("redirect-claude-md-edit decision logic", () => {
  /**
   * Replicate the hook's decision logic as a pure function for unit testing.
   * The actual hook wraps this with defineHook/wrapRun/runHook which handle
   * stdin parsing and JSON output.
   */
  function shouldDenyEdit(filePath: string): {
    deny: boolean;
    reason: string;
  } {
    const fileName = filePath.split("/").pop();
    if (fileName !== "CLAUDE.md") {
      return { deny: false, reason: "not CLAUDE.md" };
    }
    if (!isRegularFile(filePath)) {
      return { deny: false, reason: "symlink or does not exist" };
    }
    return {
      deny: true,
      reason:
        "Direct edits to CLAUDE.md are not allowed. Create AGENTS.md and make CLAUDE.md a symlink to it.",
    };
  }

  test("allows edit when file is not CLAUDE.md", ({ tempDir }) => {
    const filePath = join(tempDir, "README.md");
    writeFileSync(filePath, "# README");

    const result = shouldDenyEdit(filePath);

    expect(result.deny).toBe(false);
    expect(result.reason).toBe("not CLAUDE.md");
  });

  test("allows edit when CLAUDE.md is a symlink", ({ tempDir }) => {
    const targetPath = join(tempDir, "AGENTS.md");
    const linkPath = join(tempDir, "CLAUDE.md");
    writeFileSync(targetPath, "@AGENTS.md");
    symlinkSync(targetPath, linkPath);

    const result = shouldDenyEdit(linkPath);

    expect(result.deny).toBe(false);
    expect(result.reason).toBe("symlink or does not exist");
  });

  test("allows edit when CLAUDE.md does not exist", ({ tempDir }) => {
    const filePath = join(tempDir, "CLAUDE.md");

    const result = shouldDenyEdit(filePath);

    expect(result.deny).toBe(false);
    expect(result.reason).toBe("symlink or does not exist");
  });

  test("denies edit when CLAUDE.md is a regular file", ({ tempDir }) => {
    const filePath = join(tempDir, "CLAUDE.md");
    writeFileSync(filePath, "# CLAUDE");

    const result = shouldDenyEdit(filePath);

    expect(result.deny).toBe(true);
    expect(result.reason).toBe(
      "Direct edits to CLAUDE.md are not allowed. Create AGENTS.md and make CLAUDE.md a symlink to it.",
    );
  });

  test("allows edit for AGENTS.md even as regular file", ({ tempDir }) => {
    const filePath = join(tempDir, "AGENTS.md");
    writeFileSync(filePath, "# AGENTS");

    const result = shouldDenyEdit(filePath);

    expect(result.deny).toBe(false);
  });
});

describe("hook run function", () => {
  function makeContext(filePath: string, toolName = "Edit") {
    let result: Record<string, unknown> | undefined;
    return {
      input: {
        tool_name: toolName,
        tool_input: { file_path: filePath },
      },
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

  test("capturedRun is defined after module import", () => {
    expect(capturedHookDefs.length).toBeGreaterThan(0);
  });

  test("allows edit for non-CLAUDE.md files", ({ tempDir }) => {
    const filePath = join(tempDir, "README.md");
    writeFileSync(filePath, "# README");
    const ctx = makeContext(filePath);

    capturedHookDefs[0]!.run(ctx);

    expect(ctx.success).toHaveBeenCalled();
    expect(ctx.json).not.toHaveBeenCalled();
  });

  test("allows edit when CLAUDE.md is a symlink", ({ tempDir }) => {
    const targetPath = join(tempDir, "AGENTS.md");
    const linkPath = join(tempDir, "CLAUDE.md");
    writeFileSync(targetPath, "@AGENTS.md");
    symlinkSync(targetPath, linkPath);
    const ctx = makeContext(linkPath);

    capturedHookDefs[0]!.run(ctx);

    expect(ctx.success).toHaveBeenCalled();
    expect(ctx.json).not.toHaveBeenCalled();
  });

  test("denies edit when CLAUDE.md is a regular file", ({ tempDir }) => {
    const filePath = join(tempDir, "CLAUDE.md");
    writeFileSync(filePath, "# CLAUDE");
    const ctx = makeContext(filePath);

    capturedHookDefs[0]!.run(ctx);

    expect(ctx.json).toHaveBeenCalled();
    expect(ctx.success).not.toHaveBeenCalled();
  });
});
