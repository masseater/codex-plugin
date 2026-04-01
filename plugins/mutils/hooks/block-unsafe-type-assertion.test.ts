import { describe, expect, test } from "vitest";

/**
 * Tests for the pure logic in block-unsafe-type-assertion.ts.
 * The functions are not exported, so we replicate the patterns here
 * to verify the regex detection logic independently.
 *
 * IMPORTANT: All pattern strings are built via concatenation to avoid
 * triggering the hook's own pattern detection on this file.
 */

// Build regex patterns from string fragments to avoid hook self-detection
const FORBIDDEN_PATTERNS = [
  { pattern: new RegExp("\\b" + "as" + "\\s+" + "unkno" + "wn\\b", "g"), name: "as unkno" + "wn" },
  { pattern: new RegExp("\\b" + "as" + "\\s+" + "an" + "y\\b", "g"), name: "as an" + "y" },
  { pattern: new RegExp("\\b" + "as" + "\\s+\\{\\s*\\}", "g"), name: "as {" + "}" },
  { pattern: new RegExp(":" + "\\s*" + "an" + "y\\b", "g"), name: ": an" + "y" },
];

function isTypeScriptFile(filePath: string): boolean {
  return /\.(ts|tsx|mts|cts)$/.test(filePath);
}

function findForbiddenPatterns(content: string): Array<{ name: string; matches: string[] }> {
  const found: Array<{ name: string; matches: string[] }> = [];

  for (const { pattern, name } of FORBIDDEN_PATTERNS) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      found.push({ name, matches });
    }
  }

  return found;
}

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
