/* eslint-disable no-useless-concat -- intentional: split strings to avoid triggering hook self-detection */
import { describe, expect, test, vi } from "vite-plus/test";
import { type CapturedHook, hookContext } from "../__tests__/hook-context.ts";

/**
 * Tests for the pure logic in block-unsafe-type-assertion.ts.
 * The functions are exported from the hook entry and imported directly here.
 *
 * IMPORTANT: All pattern strings used as test input are built via string
 * concatenation to avoid this file itself triggering the hook's own
 * pattern detection when it is written/edited.
 */

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
  findForbiddenPatterns,
  formatDenyReason,
  isTypeScriptFile,
} from "./entry/block-unsafe-type-assertion.ts";

// Helper to build test input strings without triggering the hook
function buildInput(prefix: string, keyword: string, suffix: string): string {
  return prefix + "a" + "s " + keyword + suffix;
}

function buildColonInput(prefix: string, keyword: string, suffix: string): string {
  return prefix + ":" + " " + keyword + suffix;
}

describe("isTypeScriptFile", () => {
  test("returns true for .ts files", () => {
    expect(isTypeScriptFile("src/index.ts")).toBe(true);
  });

  test("returns true for .tsx files", () => {
    expect(isTypeScriptFile("components/App.tsx")).toBe(true);
  });

  test("returns true for .mts files", () => {
    expect(isTypeScriptFile("lib/util.mts")).toBe(true);
  });

  test("returns true for .cts files", () => {
    expect(isTypeScriptFile("config.cts")).toBe(true);
  });

  test("returns false for .js files", () => {
    expect(isTypeScriptFile("src/index.js")).toBe(false);
  });

  test("returns false for .json files", () => {
    expect(isTypeScriptFile("package.json")).toBe(false);
  });

  test("returns false for .md files", () => {
    expect(isTypeScriptFile("README.md")).toBe(false);
  });

  test("returns false for files without extension", () => {
    expect(isTypeScriptFile("Makefile")).toBe(false);
  });
});

describe("findForbiddenPatterns", () => {
  test("detects 'as unkno' + 'wn'", () => {
    const input = buildInput("const x = value ", "unkno" + "wn", ";");
    const result = findForbiddenPatterns(input);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("as unkno" + "wn");
  });

  test("detects 'as an' + 'y'", () => {
    const input = buildInput("const x = value ", "an" + "y", ";");
    const result = findForbiddenPatterns(input);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("as an" + "y");
  });

  test("detects 'as {' + '}'", () => {
    const input = buildInput("const x = value ", "{" + "}", ";");
    const result = findForbiddenPatterns(input);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("as {" + "}");
  });

  test("detects 'as {' + '}' with whitespace inside braces", () => {
    const input = buildInput("const x = value ", "{  " + "}", ";");
    const result = findForbiddenPatterns(input);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("as {" + "}");
  });

  test("detects ': an' + 'y' type annotation", () => {
    const input = buildColonInput("function foo(x", "an" + "y", ") {}");
    const result = findForbiddenPatterns(input);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe(": an" + "y");
  });

  test("detects multiple occurrences in one pattern", () => {
    const kw = "an" + "y";
    const input = buildInput("const a = x ", kw, ";\n") + buildInput("const b = y ", kw, ";");
    const result = findForbiddenPatterns(input);
    expect(result).toHaveLength(1);
    expect(result[0]?.matches).toHaveLength(2);
  });

  test("detects multiple different patterns", () => {
    const kw = "an" + "y";
    const input = buildInput("const a = x ", kw, ";\n") + buildColonInput("const b", kw, " = 1;");
    const result = findForbiddenPatterns(input);
    expect(result).toHaveLength(2);
    const names = result.map((r) => r.name);
    expect(names).toContain("as " + kw);
    expect(names).toContain(": " + kw);
  });

  test("returns empty array for safe code", () => {
    const result = findForbiddenPatterns("const x: string = 'hello';");
    expect(result).toStrictEqual([]);
  });

  test("returns empty array for empty content", () => {
    const result = findForbiddenPatterns("");
    expect(result).toStrictEqual([]);
  });

  test("detects '@ts-expect' + '-error'", () => {
    const input = "// @ts-expect" + "-error some reason\nconst x = 1;";
    const result = findForbiddenPatterns(input);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("@ts-expect" + "-error");
  });

  test("detects '@ts-expect' + '-error' in block comment", () => {
    const input = "/* @ts-expect" + "-error */\nconst x = 1;";
    const result = findForbiddenPatterns(input);
    expect(result).toHaveLength(1);
  });

  test("detects multiple '@ts-expect' + '-error' occurrences", () => {
    const input = "// @ts-expect" + "-error\nconst x = 1;\n// @ts-expect" + "-error\nconst y = 2;";
    const result = findForbiddenPatterns(input);
    expect(result).toHaveLength(1);
    expect(result[0]?.matches).toHaveLength(2);
  });

  test("does not flag 'as const'", () => {
    const input = buildInput("const x = { a: 1 } ", "const", ";");
    const result = findForbiddenPatterns(input);
    expect(result).toStrictEqual([]);
  });

  test("does not flag 'as string'", () => {
    const input = buildInput("const x = value ", "string", ";");
    const result = findForbiddenPatterns(input);
    expect(result).toStrictEqual([]);
  });
});

describe("formatDenyReason", () => {
  test("lists each violation with its count and the alternative", () => {
    const text = formatDenyReason([{ name: "as " + "any", matches: ["x", "y"] }]);
    expect(text).toContain("- as " + "any: 2 件");
    expect(text).toContain("satisfies");
  });
});

describe("hook run", () => {
  const run = (input: unknown) => captured.hook?.run(hookContext(input));
  const success = { kind: "success", output: {} };
  const bad = buildInput("const x = y ", "any", ";");

  test("passes when there is no input", () => {
    expect(run(undefined)).toEqual(success);
  });

  test("passes non-TypeScript files", () => {
    expect(run({ tool_name: "Write", tool_input: { file_path: "a.md", content: bad } })).toEqual(
      success,
    );
  });

  test("passes when there is no content", () => {
    expect(run({ tool_name: "Write", tool_input: { file_path: "a.ts" } })).toEqual(success);
  });

  test("passes clean content", () => {
    expect(
      run({ tool_name: "Write", tool_input: { file_path: "a.ts", content: "const x = 1;" } }),
    ).toEqual(success);
  });

  test("denies forbidden content written with Write", () => {
    const result = run({ tool_name: "Write", tool_input: { file_path: "a.ts", content: bad } });
    expect(result).toMatchObject({
      kind: "json",
      output: { output: { hookSpecificOutput: { permissionDecision: "deny" } } },
    });
  });

  test("checks new_string for Edit", () => {
    const result = run({ tool_name: "Edit", tool_input: { file_path: "a.ts", new_string: bad } });
    expect(result).toMatchObject({ kind: "json" });
  });
});
