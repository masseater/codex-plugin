import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SCRIPT_PATH = path.join(import.meta.dirname, "detect-context.ts");

function createTmpDir(): string {
  const dir = path.join(
    tmpdir(),
    `detect-ctx-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function run(dir?: string): {
  stdout: string;
  stderr: string;
  exitCode: number;
} {
  const args = dir ? [SCRIPT_PATH, dir] : [SCRIPT_PATH];
  const result = Bun.spawnSync(args, {
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

describe("detect-context", () => {
  test("detects plugin root with plugin.json", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    writeFileSync(path.join(dir, "plugin.json"), JSON.stringify({ name: "test-plugin" }));
    mkdirSync(path.join(dir, "skills", "my-skill"), { recursive: true });
    writeFileSync(
      path.join(dir, "skills", "my-skill", "SKILL.md"),
      "---\nname: my-skill\ndescription: test\n---\n",
    );

    const { stdout, exitCode } = run(dir);
    expect(exitCode).toBe(0);

    const result = JSON.parse(stdout);
    expect(result.isPlugin).toBe(true);
    expect(result.pluginName).toBe("test-plugin");
    expect(result.existingSkills).toContain("my-skill");
  });

  test("detects plugin root from subdirectory", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    writeFileSync(path.join(dir, "plugin.json"), JSON.stringify({ name: "parent-plugin" }));
    const subDir = path.join(dir, "some", "nested", "dir");
    mkdirSync(subDir, { recursive: true });

    const { stdout, exitCode } = run(subDir);
    expect(exitCode).toBe(0);

    const result = JSON.parse(stdout);
    expect(result.isPlugin).toBe(true);
    expect(result.pluginName).toBe("parent-plugin");
  });

  test("returns isPlugin false when no plugin.json found", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    const { stdout, exitCode } = run(dir);
    expect(exitCode).toBe(0);

    const result = JSON.parse(stdout);
    expect(result.isPlugin).toBe(false);
    expect(result.pluginDir).toBeNull();
    expect(result.pluginName).toBeNull();
    expect(result.existingSkills).toEqual([]);
  });

  test("ignores directories without SKILL.md in skills/", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    writeFileSync(path.join(dir, "plugin.json"), JSON.stringify({ name: "test-plugin" }));
    mkdirSync(path.join(dir, "skills", "no-skill-md"), { recursive: true });
    mkdirSync(path.join(dir, "skills", "valid-skill"), { recursive: true });
    writeFileSync(
      path.join(dir, "skills", "valid-skill", "SKILL.md"),
      "---\nname: valid\ndescription: test\n---\n",
    );

    const { stdout, exitCode } = run(dir);
    expect(exitCode).toBe(0);

    const result = JSON.parse(stdout);
    expect(result.existingSkills).toEqual(["valid-skill"]);
  });

  test("handles malformed plugin.json gracefully", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    writeFileSync(path.join(dir, "plugin.json"), "not valid json");

    const { stdout, exitCode } = run(dir);
    expect(exitCode).toBe(0);

    const result = JSON.parse(stdout);
    expect(result.isPlugin).toBe(true);
    expect(result.pluginName).toBeNull();
  });
});
