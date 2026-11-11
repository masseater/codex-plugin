import { describe, expect, test, vi } from "vitest";

const { capturedHookDef, mockIsAgnixAvailable, mockRunAgnix } = vi.hoisted(() => {
  const capturedHookDef: { run: (ctx: unknown) => unknown }[] = [];
  return {
    capturedHookDef,
    mockIsAgnixAvailable: vi.fn<() => boolean>(),
    mockRunAgnix: vi.fn<() => { exitCode: number; output: string }>(),
  };
});

vi.mock("@r_masseater/cc-plugin-lib", () => ({
  HookLogger: {
    fromFile: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      [Symbol.dispose]: vi.fn(),
    }),
  },
  wrapRun: vi.fn((_logger: unknown, fn: unknown) => fn),
}));

vi.mock("cc-hooks-ts", () => ({
  defineHook: vi.fn((def: { run: (ctx: unknown) => unknown }) => {
    capturedHookDef.push(def);
    return def;
  }),
  runHook: vi.fn(),
}));

vi.mock("./lib/agnix-runner.js", () => ({
  isAgnixAvailable: (...args: unknown[]) => mockIsAgnixAvailable(...(args as [])),
  runAgnix: (...args: unknown[]) => mockRunAgnix(...(args as [])),
}));

import { isConfigFile } from "./entry/lint-config-file.js";

// Helper to create a mock context
const createMockContext = (filePath: string) => {
  const successResult = { type: "success" };
  const jsonResult = { type: "json" };
  return {
    input: { tool_input: { file_path: filePath } },
    success: vi.fn(() => successResult),
    json: vi.fn(() => jsonResult),
  };
};

describe("isConfigFile", () => {
  describe("matches CLAUDE.md / AGENTS.md / SKILL.md", () => {
    test("matches CLAUDE.md at root", () => {
      expect(isConfigFile("CLAUDE.md")).toBe(true);
    });

    test("matches AGENTS.md with path prefix", () => {
      expect(isConfigFile("/home/user/project/AGENTS.md")).toBe(true);
    });

    test("matches SKILL.md with path prefix", () => {
      expect(isConfigFile("/some/path/SKILL.md")).toBe(true);
    });

    test("does not match lowercase claude.md", () => {
      expect(isConfigFile("claude.md")).toBe(false);
    });

    test("does not match CLAUDE.txt", () => {
      expect(isConfigFile("CLAUDE.txt")).toBe(false);
    });

    test("does not match partial name MY_CLAUDE.md", () => {
      expect(isConfigFile("MY_CLAUDE.md")).toBe(false);
    });
  });

  describe("matches hooks.json / plugin.json / settings.json", () => {
    test("matches hooks.json at root", () => {
      expect(isConfigFile("hooks.json")).toBe(true);
    });

    test("matches plugin.json with path prefix", () => {
      expect(isConfigFile("/path/to/plugin.json")).toBe(true);
    });

    test("matches settings.json", () => {
      expect(isConfigFile("settings.json")).toBe(true);
    });

    test("does not match package.json", () => {
      expect(isConfigFile("package.json")).toBe(false);
    });
  });

  describe("matches .mcp.json", () => {
    test("matches .mcp.json at root", () => {
      expect(isConfigFile(".mcp.json")).toBe(true);
    });

    test("matches .mcp.json with path prefix", () => {
      expect(isConfigFile("/home/user/.mcp.json")).toBe(true);
    });

    test("does not match mcp.json without dot prefix", () => {
      expect(isConfigFile("mcp.json")).toBe(false);
    });
  });

  describe("matches .claude/rules/*.md", () => {
    test("matches .claude/rules/my-rule.md", () => {
      expect(isConfigFile(".claude/rules/my-rule.md")).toBe(true);
    });

    test("matches .claude/rules/nested/deep.md", () => {
      expect(isConfigFile("/project/.claude/rules/nested/deep.md")).toBe(true);
    });

    test("matches .claude/settings.json (settings.json pattern)", () => {
      expect(isConfigFile(".claude/settings.json")).toBe(true);
    });
  });

  describe("non-config files", () => {
    test("does not match regular TypeScript file", () => {
      expect(isConfigFile("/src/index.ts")).toBe(false);
    });

    test("does not match README.md", () => {
      expect(isConfigFile("README.md")).toBe(false);
    });

    test("does not match tsconfig.json", () => {
      expect(isConfigFile("tsconfig.json")).toBe(false);
    });
  });
});

describe("hook run", () => {
  const getRunFn = () => {
    if (capturedHookDef.length === 0) throw new Error("defineHook was not called");
    return capturedHookDef[0]!.run as (ctx: ReturnType<typeof createMockContext>) => unknown;
  };

  test("returns success for non-config files", () => {
    const ctx = createMockContext("/src/index.ts");
    const run = getRunFn();

    run(ctx);

    expect(ctx.success).toHaveBeenCalledWith({});
    expect(mockIsAgnixAvailable).not.toHaveBeenCalled();
  });

  test("returns success when agnix is not available", () => {
    mockIsAgnixAvailable.mockReturnValue(false);
    const ctx = createMockContext("/project/CLAUDE.md");
    const run = getRunFn();

    run(ctx);

    expect(mockIsAgnixAvailable).toHaveBeenCalled();
    expect(ctx.success).toHaveBeenCalledWith({});
    expect(mockRunAgnix).not.toHaveBeenCalled();
  });

  test("returns success when agnix finds no issues", () => {
    mockIsAgnixAvailable.mockReturnValue(true);
    mockRunAgnix.mockReturnValue({ exitCode: 0, output: "" });
    const ctx = createMockContext("/project/AGENTS.md");
    const run = getRunFn();

    run(ctx);

    expect(mockRunAgnix).toHaveBeenCalled();
    expect(ctx.success).toHaveBeenCalledWith({});
  });

  test("returns json with lint results when agnix finds issues", () => {
    mockIsAgnixAvailable.mockReturnValue(true);
    mockRunAgnix.mockReturnValue({ exitCode: 1, output: "warning: missing section" });
    const ctx = createMockContext("/project/SKILL.md");
    const run = getRunFn();

    run(ctx);

    expect(ctx.json).toHaveBeenCalledWith({
      event: "PostToolUse",
      output: {
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: "agnix lint results for SKILL.md:\nwarning: missing section",
        },
        suppressOutput: true,
      },
    });
  });
});
