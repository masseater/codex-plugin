import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { runScript } from "../../../__tests__/run-script.ts";
import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

type ValidationResult = { valid: boolean; errors: string[]; warnings: string[] };

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

// validate.ts が stdout に出す JSON を検証して読む
function parseValidationResult(stdout: string): ValidationResult {
  const parsed: unknown = JSON.parse(stdout);
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "valid" in parsed &&
    typeof parsed.valid === "boolean" &&
    "errors" in parsed &&
    isStringArray(parsed.errors) &&
    "warnings" in parsed &&
    isStringArray(parsed.warnings)
  ) {
    return { valid: parsed.valid, errors: parsed.errors, warnings: parsed.warnings };
  }
  throw new Error(`unexpected validate.ts output: ${stdout}`);
}

const SCRIPT_PATH = path.join(import.meta.dirname, "validate.ts");

function createTmpSkill(): string {
  const dir = path.join(
    tmpdir(),
    `validate-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function run(skillDir?: string) {
  return runScript(SCRIPT_PATH, skillDir ? [skillDir] : []);
}

const tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

describe("validate", () => {
  test("passes for a well-formed SKILL.md with single-quoted triggers", async () => {
    const dir = createTmpSkill();
    tmpDirs.push(dir);

    const body = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
    writeFileSync(
      path.join(dir, "SKILL.md"),
      `---\nname: good-skill\ndescription: "This skill should be used when the user asks to 'do X' or 'configure Y'."\ndisable-model-invocation: true\n---\n\n# Good Skill\n\n${body}\n`,
    );

    const { stdout, exitCode } = await run(dir);
    expect(exitCode).toBe(0);

    const result = JSON.parse(stdout);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("passes for a well-formed SKILL.md with double-quoted triggers", async () => {
    const dir = createTmpSkill();
    tmpDirs.push(dir);

    const body = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
    writeFileSync(
      path.join(dir, "SKILL.md"),
      `---\nname: good-skill\ndescription: "This skill should be used when the user asks to \\"do X\\" or \\"configure Y\\"."\ndisable-model-invocation: true\n---\n\n# Good Skill\n\n${body}\n`,
    );

    const { stdout, exitCode } = await run(dir);
    expect(exitCode).toBe(0);

    const result = JSON.parse(stdout);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("errors when SKILL.md is missing", async () => {
    const dir = createTmpSkill();
    tmpDirs.push(dir);

    const { stdout, exitCode } = await run(dir);
    expect(exitCode).toBe(0);

    const result = JSON.parse(stdout);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("SKILL.md not found");
  });

  test("errors when frontmatter is missing", async () => {
    const dir = createTmpSkill();
    tmpDirs.push(dir);

    writeFileSync(path.join(dir, "SKILL.md"), "# No frontmatter\n");

    const { stdout, exitCode } = await run(dir);
    expect(exitCode).toBe(0);

    const result = JSON.parse(stdout);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("frontmatter");
  });

  test("errors when name field is missing", async () => {
    const dir = createTmpSkill();
    tmpDirs.push(dir);

    writeFileSync(path.join(dir, "SKILL.md"), "---\ndescription: test\n---\n\n# Test\n");

    const { stdout, exitCode } = await run(dir);
    expect(exitCode).toBe(0);

    const result = JSON.parse(stdout);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining("name"));
  });

  function write(dir: string, frontmatter: string, body = "# Test\n\nRun the script.\n"): void {
    writeFileSync(path.join(dir, "SKILL.md"), `---\n${frontmatter}\n---\n\n${body}`);
  }

  async function validateWith(frontmatter: string, body?: string) {
    const dir = createTmpSkill();
    tmpDirs.push(dir);
    write(dir, frontmatter, body);
    const { stdout, exitCode } = await run(dir);
    expect(exitCode).toBe(0);
    return parseValidationResult(stdout);
  }

  test("accepts a short skill without disable-model-invocation", async () => {
    const result = await validateWith(
      "name: short-skill\ndescription: Formats CSV files. Use when the user asks to clean a CSV.",
    );
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  test("warns on the 'This skill should be used when' boilerplate", async () => {
    const result = await validateWith(
      "name: test-skill\ndescription: \"This skill should be used when the user asks to 'do X'.\"",
    );
    expect(result.warnings.some((w) => w.includes("This skill should be used when"))).toBe(true);
  });

  test("warns when disable-model-invocation is explicitly false", async () => {
    const result = await validateWith(
      "name: test-skill\ndescription: Does X.\ndisable-model-invocation: false",
    );
    expect(result.warnings.some((w) => w.includes("Omit the field"))).toBe(true);
  });

  test("warns when disabled skills advertise natural-language triggers", async () => {
    const result = await validateWith(
      "name: disabled-trigger\ndescription: Does X. Use when the user asks to do X.\ndisable-model-invocation: true",
    );
    expect(result.warnings.some((w) => w.includes("natural-language triggers"))).toBe(true);
  });

  test("warns when disabled skills advertise Japanese natural-language triggers", async () => {
    const result = await validateWith(
      "name: disabled-trigger-ja\ndescription: X をする。X してと頼まれたときに使う。\ndisable-model-invocation: true",
    );
    expect(result.warnings.some((w) => w.includes("natural-language triggers"))).toBe(true);
  });

  test("does not warn about Japanese triggers on model-invocable skills", async () => {
    const result = await validateWith(
      "name: invocable-ja\ndescription: X をする。X してと頼まれたときに使う。",
    );
    expect(result.warnings.some((w) => w.includes("natural-language triggers"))).toBe(false);
  });

  test("errors when description exceeds the listing budget", async () => {
    const result = await validateWith(`name: long\ndescription: ${"x".repeat(1600)}`);
    expect(result.errors.some((e) => e.includes("1536"))).toBe(true);
  });

  test("errors on the unsupported tools field", async () => {
    const result = await validateWith("name: t\ndescription: Does X.\ntools:\n  - Read");
    expect(result.errors.some((e) => e.includes("allowed-tools"))).toBe(true);
  });

  test("errors on the nonexistent CLAUDE_PLUGIN_DIR variable", async () => {
    const result = await validateWith(
      "name: t\ndescription: Does X.",
      "Read `${CLAUDE_PLUGIN_DIR}/assets/a.md`.\n",
    );
    expect(result.errors.some((e) => e.includes("CLAUDE_PLUGIN_DIR"))).toBe(true);
  });

  test("warns when the body reaches 500 lines", async () => {
    const result = await validateWith(
      "name: t\ndescription: Does X.",
      Array.from({ length: 510 }, (_, i) => `line ${i}`).join("\n"),
    );
    expect(result.warnings.some((w) => w.includes("500 lines"))).toBe(true);
  });

  test("warns when script lacks executable permission", async () => {
    const dir = createTmpSkill();
    tmpDirs.push(dir);

    const body = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
    writeFileSync(
      path.join(dir, "SKILL.md"),
      `---\nname: test-skill\ndescription: "This skill should be used when \\"testing\\" or \\"validating\\"."\n---\n\n# Test\n\n${body}\n`,
    );
    mkdirSync(path.join(dir, "scripts"));
    writeFileSync(path.join(dir, "scripts", "run.ts"), "#!/usr/bin/env bun\n");
    chmodSync(path.join(dir, "scripts", "run.ts"), 0o644);

    const { stdout, exitCode } = await run(dir);
    expect(exitCode).toBe(0);

    const result = JSON.parse(stdout);
    expect(result.warnings.some((w: string) => w.includes("executable"))).toBe(true);
  });

  test("warns on second-person writing in prose", async () => {
    const dir = createTmpSkill();
    tmpDirs.push(dir);

    const body = "You should run the command. ".repeat(5);
    writeFileSync(
      path.join(dir, "SKILL.md"),
      `---\nname: test-skill\ndescription: "This skill should be used when \\"testing\\""\n---\n\n# Test\n\n${body}\n`,
    );

    const { stdout, exitCode } = await run(dir);
    expect(exitCode).toBe(0);

    const result = JSON.parse(stdout);
    expect(result.warnings.some((w: string) => w.includes("second-person"))).toBe(true);
  });

  test("ignores second-person writing inside code fences", async () => {
    const dir = createTmpSkill();
    tmpDirs.push(dir);

    const body = [
      "Run the command to start.",
      "",
      "```bash",
      "# You should see output here",
      "echo hello",
      "```",
      "",
      ...Array.from({ length: 50 }, (_, i) => `word${i}`),
    ].join("\n");
    writeFileSync(
      path.join(dir, "SKILL.md"),
      `---\nname: test-skill\ndescription: "This skill should be used when \\"testing\\""\n---\n\n# Test\n\n${body}\n`,
    );

    const { stdout, exitCode } = await run(dir);
    expect(exitCode).toBe(0);

    const result = JSON.parse(stdout);
    expect(result.warnings.some((w: string) => w.includes("second-person"))).toBe(false);
  });

  test("errors when referenced file does not exist", async () => {
    const dir = createTmpSkill();
    tmpDirs.push(dir);

    writeFileSync(
      path.join(dir, "SKILL.md"),
      '---\nname: test-skill\ndescription: "This skill is for tests"\n---\n\n# Test\n\nSee `scripts/missing.ts` for details.\n',
    );

    const { stdout, exitCode } = await run(dir);
    expect(exitCode).toBe(0);

    const result = JSON.parse(stdout);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes("scripts/missing.ts"))).toBe(true);
  });

  test("fails without arguments", async () => {
    const result = await run();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Usage:");
  });
});
