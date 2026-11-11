import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test as base, describe, expect, vi } from "vite-plus/test";

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

import { decide, fileKind, importsAgentsMd } from "./entry/redirect-claude-md-edit.js";

const test = base.extend<{ tempDir: string }>({
  tempDir: async ({}, use) => {
    const dir = join(tmpdir(), `redirect-hook-test-${Date.now()}-${Math.random()}`);
    mkdirSync(dir, { recursive: true });
    await use(dir);
    rmSync(dir, { recursive: true, force: true });
  },
});

describe("fileKind", () => {
  test("regular file", ({ tempDir }) => {
    const filePath = join(tempDir, "CLAUDE.md");
    writeFileSync(filePath, "# content");
    expect(fileKind(filePath)).toBe("file");
  });

  test("symlink", ({ tempDir }) => {
    const targetPath = join(tempDir, "AGENTS.md");
    const linkPath = join(tempDir, "CLAUDE.md");
    writeFileSync(targetPath, "# AGENTS");
    symlinkSync(targetPath, linkPath);
    expect(fileKind(linkPath)).toBe("symlink");
  });

  test("missing path", ({ tempDir }) => {
    expect(fileKind(join(tempDir, "nonexistent.md"))).toBe("missing");
  });

  test("directory", ({ tempDir }) => {
    const dirPath = join(tempDir, "subdir");
    mkdirSync(dirPath);
    expect(fileKind(dirPath)).toBe("other");
  });
});

describe("importsAgentsMd", () => {
  test("detects @AGENTS.md line", () => {
    expect(importsAgentsMd("@AGENTS.md\n\n# Claude only\n")).toBe(true);
  });

  test("detects path import such as @~/AGENTS.md", () => {
    expect(importsAgentsMd("intro\n@~/AGENTS.md\n")).toBe(true);
  });

  test("ignores inline mention", () => {
    expect(importsAgentsMd("see @AGENTS.md for details")).toBe(false);
  });
});

describe("decide", () => {
  const home = "/nonexistent-home";

  test("allows non-CLAUDE.md files", ({ tempDir }) => {
    const filePath = join(tempDir, "README.md");
    expect(decide({ toolName: "Write", filePath, content: "x" }, home).deny).toBe(false);
  });

  test("allows the user instructions file ~/.claude/CLAUDE.md", ({ tempDir }) => {
    const filePath = join(tempDir, ".claude", "CLAUDE.md");
    mkdirSync(join(tempDir, ".claude"));
    writeFileSync(filePath, "# mine");
    const result = decide({ toolName: "Write", filePath, content: "# rules" }, tempDir);
    expect(result.deny).toBe(false);
  });

  test("allows a symlinked CLAUDE.md", ({ tempDir }) => {
    const targetPath = join(tempDir, "AGENTS.md");
    const linkPath = join(tempDir, "CLAUDE.md");
    writeFileSync(targetPath, "# AGENTS");
    symlinkSync(targetPath, linkPath);
    const result = decide(
      { toolName: "Edit", filePath: linkPath, oldString: "#", newString: "##", replaceAll: false },
      home,
    );
    expect(result.deny).toBe(false);
  });

  test("allows writing a CLAUDE.md that imports AGENTS.md", ({ tempDir }) => {
    const filePath = join(tempDir, "CLAUDE.md");
    const result = decide(
      { toolName: "Write", filePath, content: "@AGENTS.md\n\n- Claude only rule\n" },
      home,
    );
    expect(result.deny).toBe(false);
  });

  test("allows editing below the import in an import-style CLAUDE.md", ({ tempDir }) => {
    const filePath = join(tempDir, "CLAUDE.md");
    writeFileSync(filePath, "@AGENTS.md\n\n- old\n");
    const result = decide(
      { toolName: "Edit", filePath, oldString: "- old", newString: "- new", replaceAll: false },
      home,
    );
    expect(result.deny).toBe(false);
  });

  test("denies an edit that removes the import", ({ tempDir }) => {
    const filePath = join(tempDir, "CLAUDE.md");
    writeFileSync(filePath, "@AGENTS.md\n\n- old\n");
    const result = decide(
      { toolName: "Edit", filePath, oldString: "@AGENTS.md\n", newString: "", replaceAll: false },
      home,
    );
    expect(result.deny).toBe(true);
  });

  test("denies editing a standalone CLAUDE.md and points to AGENTS.md", ({ tempDir }) => {
    const filePath = join(tempDir, "CLAUDE.md");
    writeFileSync(filePath, "# Project\n- rule\n");
    const result = decide(
      { toolName: "Edit", filePath, oldString: "- rule", newString: "- rule2", replaceAll: false },
      home,
    );
    expect(result.deny).toBe(true);
    expect(result.reason).toContain(join(tempDir, "AGENTS.md"));
    expect(result.reason).toContain("@AGENTS.md");
  });

  test("treats $ patterns in new_string literally like the Edit tool", ({ tempDir }) => {
    const filePath = join(tempDir, "CLAUDE.md");
    writeFileSync(filePath, "# P\n");
    // String.prototype.replace なら "$`" が空文字に展開されて import 行に見えるが、Edit は文字どおり書く
    const result = decide(
      {
        toolName: "Edit",
        filePath,
        oldString: "# P",
        newString: "$`@AGENTS.md",
        replaceAll: false,
      },
      home,
    );
    expect(result.deny).toBe(true);
  });

  test("denies creating a standalone CLAUDE.md", ({ tempDir }) => {
    const filePath = join(tempDir, "CLAUDE.md");
    const result = decide({ toolName: "Write", filePath, content: "# Project\n" }, home);
    expect(result.deny).toBe(true);
  });

  test("allows Edit on a missing CLAUDE.md (the tool itself fails)", ({ tempDir }) => {
    const filePath = join(tempDir, "CLAUDE.md");
    const result = decide(
      { toolName: "Edit", filePath, oldString: "a", newString: "b", replaceAll: false },
      home,
    );
    expect(result.deny).toBe(false);
  });
});

describe("hook run function", () => {
  function makeContext(toolName: string, toolInput: Record<string, unknown>) {
    return {
      input: { tool_name: toolName, tool_input: toolInput },
      success: vi.fn(() => ({ type: "success" })),
      json: vi.fn((val: unknown) => ({ type: "json", value: val })),
    };
  }

  test("hook is registered on import", () => {
    expect(capturedHookDefs.length).toBeGreaterThan(0);
  });

  test("allows non-CLAUDE.md files", ({ tempDir }) => {
    const ctx = makeContext("Write", { file_path: join(tempDir, "README.md"), content: "x" });
    capturedHookDefs[0]!.run(ctx);
    expect(ctx.success).toHaveBeenCalled();
    expect(ctx.json).not.toHaveBeenCalled();
  });

  test("denies editing a standalone CLAUDE.md", ({ tempDir }) => {
    const filePath = join(tempDir, "CLAUDE.md");
    writeFileSync(filePath, "# CLAUDE");
    const ctx = makeContext("Edit", {
      file_path: filePath,
      old_string: "# CLAUDE",
      new_string: "# X",
    });
    capturedHookDefs[0]!.run(ctx);
    expect(ctx.json).toHaveBeenCalledWith(
      expect.objectContaining({
        output: {
          hookSpecificOutput: expect.objectContaining({ permissionDecision: "deny" }),
        },
      }),
    );
  });
});
