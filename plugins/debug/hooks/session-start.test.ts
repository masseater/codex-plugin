import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test as base, describe, expect, vi } from "vitest";

// Capture the run function passed to defineHook
let capturedRun: ((context: unknown) => Promise<unknown>) | undefined;

vi.mock("@r_masseater/cc-plugin-lib", () => ({
  HookLogger: {
    fromFile: () => ({
      debug: vi.fn(),
      warn: vi.fn(),
      [Symbol.dispose]: vi.fn(),
    }),
  },
  wrapRun: vi.fn((_logger: unknown, fn: unknown) => fn),
}));
vi.mock("cc-hooks-ts", () => ({
  defineHook: vi.fn((opts: { run: (ctx: unknown) => Promise<unknown> }) => {
    capturedRun = opts.run;
    return { trigger: { SessionStart: true }, run: opts.run };
  }),
  runHook: vi.fn(),
}));

import {
  buildDebugMessage,
  resolveDebugFile,
  resolveStateDir,
  writeDebugFile,
} from "./lib/debug-file.ts";

const test = base.extend<{ tempDir: string }>({
  tempDir: async ({}, use) => {
    const dir = join(tmpdir(), `debug-hook-test-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    await use(dir);
    rmSync(dir, { recursive: true, force: true });
  },
});

describe("resolveStateDir", () => {
  test("uses XDG_STATE_HOME when set", () => {
    const original = process.env.XDG_STATE_HOME;
    try {
      process.env.XDG_STATE_HOME = "/custom/state";
      expect(resolveStateDir()).toBe("/custom/state");
    } finally {
      if (original === undefined) delete process.env.XDG_STATE_HOME;
      else process.env.XDG_STATE_HOME = original;
    }
  });

  test("falls back to HOME/.local/state when XDG_STATE_HOME is unset", () => {
    const originalXdg = process.env.XDG_STATE_HOME;
    const originalHome = process.env.HOME;
    try {
      delete process.env.XDG_STATE_HOME;
      process.env.HOME = "/home/testuser";
      expect(resolveStateDir()).toBe("/home/testuser/.local/state");
    } finally {
      if (originalXdg === undefined) delete process.env.XDG_STATE_HOME;
      else process.env.XDG_STATE_HOME = originalXdg;
      process.env.HOME = originalHome;
    }
  });
});

describe("resolveDebugFile", () => {
  test("appends claude-code-plugin/debug.txt to state dir", () => {
    expect(resolveDebugFile("/some/state")).toBe("/some/state/claude-code-plugin/debug.txt");
  });
});

describe("writeDebugFile", () => {
  test("creates debug.txt with pluginRoot content", ({ tempDir }) => {
    const pluginRoot = "/home/user/.claude/plugins/debug";
    const debugFilePath = resolveDebugFile(tempDir);

    writeDebugFile(debugFilePath, pluginRoot);

    expect(existsSync(debugFilePath)).toBe(true);
    const content = readFileSync(debugFilePath, "utf-8");
    expect(content).toBe(`${pluginRoot}\n`);
  });

  test("creates parent directory recursively", ({ tempDir }) => {
    const stateDir = join(tempDir, "nested", "deep");
    const debugFilePath = resolveDebugFile(stateDir);

    writeDebugFile(debugFilePath, "/some/path");

    expect(existsSync(dirname(debugFilePath))).toBe(true);
    expect(existsSync(debugFilePath)).toBe(true);
  });

  test("overwrites existing debug.txt", ({ tempDir }) => {
    const debugFilePath = resolveDebugFile(tempDir);

    writeDebugFile(debugFilePath, "/first/path");
    writeDebugFile(debugFilePath, "/second/path");

    const content = readFileSync(debugFilePath, "utf-8");
    expect(content).toBe("/second/path\n");
  });
});

describe("buildDebugMessage", () => {
  test("contains debug file path", () => {
    const debugFilePath = "/state/claude-code-plugin/debug.txt";
    const message = buildDebugMessage(debugFilePath, "/plugins/debug");

    expect(message).toContain(debugFilePath);
  });

  test("contains CLAUDE_PLUGIN_ROOT value", () => {
    const message = buildDebugMessage("/some/file", "/custom/plugin/root");

    expect(message).toContain("CLAUDE_PLUGIN_ROOT: `/custom/plugin/root`");
  });

  test("handles (unset) pluginRoot", () => {
    const message = buildDebugMessage("/some/file", "(unset)");

    expect(message).toContain("CLAUDE_PLUGIN_ROOT: `(unset)`");
  });

  test("includes section headers", () => {
    const message = buildDebugMessage("/some/file", "/root");

    expect(message).toContain("# Debug Plugin Active");
    expect(message).toContain("## Saved Data");
    expect(message).toContain("## Environment");
  });
});

describe("session-start hook integration", () => {
  test("hook module can be imported and defineHook is called", async () => {
    await import("./entry/session-start.ts");
    expect(capturedRun).toBeDefined();
  });

  test("run callback writes debug file and returns SessionStart response", async ({ tempDir }) => {
    await import("./entry/session-start.ts");
    expect(capturedRun).toBeDefined();

    const originalXdg = process.env.XDG_STATE_HOME;
    const originalPlugin = process.env.CLAUDE_PLUGIN_ROOT;
    try {
      process.env.XDG_STATE_HOME = tempDir;
      process.env.CLAUDE_PLUGIN_ROOT = "/test/plugin/root";

      let jsonArg: unknown;
      const fakeContext = {
        json: (arg: unknown) => {
          jsonArg = arg;
          return arg;
        },
      };

      const result = await capturedRun!(fakeContext);

      // Verify file was written
      const debugFilePath = resolveDebugFile(tempDir);
      expect(existsSync(debugFilePath)).toBe(true);
      const content = readFileSync(debugFilePath, "utf-8");
      expect(content).toBe("/test/plugin/root\n");

      // Verify response structure
      expect(jsonArg).toMatchObject({
        event: "SessionStart",
        output: {
          hookSpecificOutput: {
            hookEventName: "SessionStart",
          },
          suppressOutput: true,
        },
      });
    } finally {
      if (originalXdg === undefined) delete process.env.XDG_STATE_HOME;
      else process.env.XDG_STATE_HOME = originalXdg;
      if (originalPlugin === undefined) delete process.env.CLAUDE_PLUGIN_ROOT;
      else process.env.CLAUDE_PLUGIN_ROOT = originalPlugin;
    }
  });

  test("run callback uses (unset) when CLAUDE_PLUGIN_ROOT is missing", async ({ tempDir }) => {
    await import("./entry/session-start.ts");
    expect(capturedRun).toBeDefined();

    const originalXdg = process.env.XDG_STATE_HOME;
    const originalPlugin = process.env.CLAUDE_PLUGIN_ROOT;
    try {
      process.env.XDG_STATE_HOME = tempDir;
      delete process.env.CLAUDE_PLUGIN_ROOT;

      let jsonArg: Record<string, unknown> | undefined;
      const fakeContext = {
        json: (arg: Record<string, unknown>) => {
          jsonArg = arg;
          return arg;
        },
      };

      await capturedRun!(fakeContext);

      const debugFilePath = resolveDebugFile(tempDir);
      const content = readFileSync(debugFilePath, "utf-8");
      expect(content).toBe("(unset)\n");

      const output = jsonArg?.output as Record<string, unknown>;
      const hookOutput = output?.hookSpecificOutput as Record<string, unknown>;
      expect(hookOutput?.additionalContext).toContain("CLAUDE_PLUGIN_ROOT: `(unset)`");
    } finally {
      if (originalXdg === undefined) delete process.env.XDG_STATE_HOME;
      else process.env.XDG_STATE_HOME = originalXdg;
      if (originalPlugin === undefined) delete process.env.CLAUDE_PLUGIN_ROOT;
      else process.env.CLAUDE_PLUGIN_ROOT = originalPlugin;
    }
  });
});
