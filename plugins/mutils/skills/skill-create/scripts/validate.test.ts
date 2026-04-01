import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SCRIPT_PATH = path.join(import.meta.dirname, "validate.ts");

function createTmpSkill(): string {
  const dir = path.join(
    tmpdir(),
    `validate-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function run(skillDir: string): {
  stdout: string;
  stderr: string;
  exitCode: number;
} {
  const result = Bun.spawnSync([SCRIPT_PATH, skillDir], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    exitCode: result.exitCode,
  };
}

const tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

describe("validate", () => {
  test("passes for a well-formed SKILL.md with single-quoted triggers", () => {
    const dir = createTmpSkill();
    tmpDirs.push(dir);

    const body = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
    writeFileSync(
      path.join(dir, "SKILL.md"),
      `---\nname: good-skill\ndescription: "This skill should be used when the user asks to 'do X' or 'configure Y'."\n---\n\n# Good Skill\n\n${body}\n`,
    );

    const { stdout, exitCode } = run(dir);
    expect(exitCode).toBe(0);

    const result = JSON.parse(stdout);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("passes for a well-formed SKILL.md with double-quoted triggers", () => {
    const dir = createTmpSkill();
    tmpDirs.push(dir);

    const body = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
    writeFileSync(
      path.join(dir, "SKILL.md"),
      `---\nname: good-skill\ndescription: "This skill should be used when the user asks to \\"do X\\" or \\"configure Y\\"."\n---\n\n# Good Skill\n\n${body}\n`,
    );

    const { stdout, exitCode } = run(dir);
    expect(exitCode).toBe(0);

    const result = JSON.parse(stdout);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test("errors when SKILL.md is missing", () => {
    const dir = createTmpSkill();
    tmpDirs.push(dir);

    const { stdout, exitCode } = run(dir);
    expect(exitCode).toBe(0);

    const result = JSON.parse(stdout);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("SKILL.md not found");
  });

  test("errors when frontmatter is missing", () => {
    const dir = createTmpSkill();
    tmpDirs.push(dir);

    writeFileSync(path.join(dir, "SKILL.md"), "# No frontmatter\n");

    const { stdout, exitCode } = run(dir);
    expect(exitCode).toBe(0);

    const result = JSON.parse(stdout);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("frontmatter");
  });

  test("errors when name field is missing", () => {
    const dir = createTmpSkill();
    tmpDirs.push(dir);

    writeFileSync(path.join(dir, "SKILL.md"), "---\ndescription: test\n---\n\n# Test\n");

    const { stdout, exitCode } = run(dir);
    expect(exitCode).toBe(0);

    const result = JSON.parse(stdout);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.stringContaining("name"));
  });

  test("warns when description lacks third-person form", () => {
    const dir = createTmpSkill();
    tmpDirs.push(dir);

    const body = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
    writeFileSync(
      path.join(dir, "SKILL.md"),
      `---\nname: test-skill\ndescription: "Create and manage stuff"\n---\n\n# Test\n\n${body}\n`,
    );

    const { stdout, exitCode } = run(dir);
    expect(exitCode).toBe(0);

    const result = JSON.parse(stdout);
    expect(result.warnings.some((w: string) => w.includes("third-person"))).toBe(true);
  });

  test("warns when body is very short", () => {
    const dir = createTmpSkill();
    tmpDirs.push(dir);

    writeFileSync(
      path.join(dir, "SKILL.md"),
      '---\nname: short\ndescription: "This skill is for tests"\n---\n\n# Short\n\nHello world.\n',
    );

    const { stdout, exitCode } = run(dir);
    expect(exitCode).toBe(0);

    const result = JSON.parse(stdout);
    expect(result.warnings.some((w: string) => w.includes("short"))).toBe(true);
  });

  test("warns when script lacks executable permission", () => {
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

    const { stdout, exitCode } = run(dir);
    expect(exitCode).toBe(0);

    const result = JSON.parse(stdout);
    expect(result.warnings.some((w: string) => w.includes("executable"))).toBe(true);
  });

  test("warns on second-person writing in prose", () => {
    const dir = createTmpSkill();
    tmpDirs.push(dir);

    const body = "You should run the command. ".repeat(5);
    writeFileSync(
      path.join(dir, "SKILL.md"),
      `---\nname: test-skill\ndescription: "This skill should be used when \\"testing\\""\n---\n\n# Test\n\n${body}\n`,
    );

    const { stdout, exitCode } = run(dir);
    expect(exitCode).toBe(0);

    const result = JSON.parse(stdout);
    expect(result.warnings.some((w: string) => w.includes("second-person"))).toBe(true);
  });

  test("ignores second-person writing inside code fences", () => {
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

    const { stdout, exitCode } = run(dir);
    expect(exitCode).toBe(0);

    const result = JSON.parse(stdout);
    expect(result.warnings.some((w: string) => w.includes("second-person"))).toBe(false);
  });

  test("errors when referenced file does not exist", () => {
    const dir = createTmpSkill();
    tmpDirs.push(dir);

    writeFileSync(
      path.join(dir, "SKILL.md"),
      '---\nname: test-skill\ndescription: "This skill is for tests"\n---\n\n# Test\n\nSee `scripts/missing.ts` for details.\n',
    );

    const { stdout, exitCode } = run(dir);
    expect(exitCode).toBe(0);

    const result = JSON.parse(stdout);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e: string) => e.includes("scripts/missing.ts"))).toBe(true);
  });

  test("fails without arguments", () => {
    const result = Bun.spawnSync([SCRIPT_PATH], {
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("Usage:");
  });
});
