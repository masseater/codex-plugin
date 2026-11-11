import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { runScript } from "../../../__tests__/run-script.ts";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SCRIPT_PATH = path.join(import.meta.dirname, "scaffold.ts");

function createTmpDir(): string {
  const dir = path.join(
    tmpdir(),
    `scaffold-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  mkdirSync(path.join(dir, ".claude-plugin"), { recursive: true });
  writeFileSync(
    path.join(dir, ".claude-plugin/plugin.json"),
    JSON.stringify({ name: "test-plugin" }),
  );
  return dir;
}

function run(...args: string[]) {
  return runScript(SCRIPT_PATH, args);
}

const tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

describe("scaffold", () => {
  test("creates skill directory with SKILL.md", async () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    const { stdout, exitCode } = await run("--plugin-dir", dir, "--skill-name", "my-skill");
    expect(exitCode).toBe(0);

    const result = JSON.parse(stdout);
    expect(result.files).toContain("SKILL.md");

    const skillDir = path.join(dir, "skills", "my-skill");
    expect(existsSync(skillDir)).toBe(true);

    const skillMd = readFileSync(path.join(skillDir, "SKILL.md"), "utf-8");
    expect(skillMd).toContain("name: my-skill");
    expect(skillMd).toContain("description:");
    expect(skillMd).not.toContain("disable-model-invocation");
  });

  test("creates scripts/ directory with --scripts flag", async () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    const { stdout, exitCode } = await run(
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

  test("creates references/ directory with --references flag", async () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    const { stdout, exitCode } = await run(
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

  test("fails without arguments", async () => {
    const { exitCode, stderr } = await run();
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Missing required option");
  });

  test("rejects non-kebab-case names", async () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    const { exitCode, stderr } = await run("--plugin-dir", dir, "--skill-name", "MySkill");
    expect(exitCode).toBe(1);
    expect(stderr).toContain("kebab-case");
  });

  test("rejects names starting with a digit", async () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    const { exitCode, stderr } = await run("--plugin-dir", dir, "--skill-name", "1-bad");
    expect(exitCode).toBe(1);
    expect(stderr).toContain("kebab-case");
  });

  test("fails if skill directory already exists", async () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    const skillDir = path.join(dir, "skills", "existing");
    mkdirSync(skillDir, { recursive: true });

    const { exitCode, stderr } = await run("--plugin-dir", dir, "--skill-name", "existing");
    expect(exitCode).toBe(1);
    expect(stderr).toContain("already exists");
  });
});
