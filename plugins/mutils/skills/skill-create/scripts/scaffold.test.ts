import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SCRIPT_PATH = path.join(import.meta.dirname, "scaffold.ts");

function createTmpDir(): string {
  const dir = path.join(
    tmpdir(),
    `scaffold-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function run(...args: string[]): {
  stdout: string;
  stderr: string;
  exitCode: number;
} {
  const result = Bun.spawnSync([SCRIPT_PATH, ...args], {
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

describe("scaffold", () => {
  test("creates skill directory with SKILL.md", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    const { stdout, exitCode } = run("--plugin-dir", dir, "--skill-name", "my-skill");
    expect(exitCode).toBe(0);

    const result = JSON.parse(stdout);
    expect(result.files).toContain("SKILL.md");

    const skillDir = path.join(dir, "skills", "my-skill");
    expect(existsSync(skillDir)).toBe(true);

    const skillMd = readFileSync(path.join(skillDir, "SKILL.md"), "utf-8");
    expect(skillMd).toContain("name: my-skill");
    expect(skillMd).toContain("description:");
  });

  test("creates scripts/ directory with --scripts flag", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    const { stdout, exitCode } = run(
      "--plugin-dir",
      dir,
      "--skill-name",
      "test-skill",
      "--scripts",
    );
    expect(exitCode).toBe(0);

    const result = JSON.parse(stdout);
    expect(result.dirs).toContain("scripts/");

    const scriptsDir = path.join(dir, "skills", "test-skill", "scripts");
    expect(existsSync(scriptsDir)).toBe(true);
  });

  test("creates references/ directory with --references flag", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    const { stdout, exitCode } = run(
      "--plugin-dir",
      dir,
      "--skill-name",
      "test-skill",
      "--references",
    );
    expect(exitCode).toBe(0);

    const result = JSON.parse(stdout);
    expect(result.dirs).toContain("references/");

    const refsDir = path.join(dir, "skills", "test-skill", "references");
    expect(existsSync(refsDir)).toBe(true);
  });

  test("fails without arguments", () => {
    const { exitCode, stderr } = run();
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Missing required option");
  });

  test("rejects non-kebab-case names", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    const { exitCode, stderr } = run("--plugin-dir", dir, "--skill-name", "MySkill");
    expect(exitCode).toBe(1);
    expect(stderr).toContain("kebab-case");
  });

  test("rejects names starting with a digit", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    const { exitCode, stderr } = run("--plugin-dir", dir, "--skill-name", "1-bad");
    expect(exitCode).toBe(1);
    expect(stderr).toContain("kebab-case");
  });

  test("fails if skill directory already exists", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    const skillDir = path.join(dir, "skills", "existing");
    mkdirSync(skillDir, { recursive: true });

    const { exitCode, stderr } = run("--plugin-dir", dir, "--skill-name", "existing");
    expect(exitCode).toBe(1);
    expect(stderr).toContain("already exists");
  });
});
