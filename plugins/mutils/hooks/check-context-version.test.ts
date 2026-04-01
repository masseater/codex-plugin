import { afterEach, describe, expect, test } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { rsort, valid } from "semver";
import { readdirSync, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

/**
 * Tests for the pure logic in check-context-version.ts.
 * We replicate getInstalledVersion and getReferencedVersions logic
 * using temp directories instead of the real HOME-based paths.
 */

function getInstalledVersion(pluginCacheDir: string): string | null {
  if (!existsSync(pluginCacheDir)) {
    return null;
  }

  const versions = readdirSync(pluginCacheDir).filter((v) => valid(v) !== null);
  const sorted = rsort(versions);
  return sorted[0] ?? null;
}

async function getReferencedVersions(
  contextFiles: string[],
  versionPattern: RegExp,
): Promise<Map<string, string>> {
  const versions = new Map<string, string>();

  for (const file of contextFiles) {
    if (!existsSync(file)) {
      continue;
    }

    const content = await readFile(file, "utf-8");
    const match = content.match(versionPattern);

    if (match?.[1]) {
      versions.set(file, match[1]);
    }
  }

  return versions;
}

function createTmpDir(): string {
  const dir = path.join(
    tmpdir(),
    `check-ctx-ver-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

const tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

describe("getInstalledVersion", () => {
  test("returns null for non-existent directory", () => {
    const result = getInstalledVersion("/nonexistent-dir-99999");
    expect(result).toBeNull();
  });

  test("returns the highest version", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    mkdirSync(path.join(dir, "1.0.0"));
    mkdirSync(path.join(dir, "2.1.0"));
    mkdirSync(path.join(dir, "1.5.3"));

    const result = getInstalledVersion(dir);
    expect(result).toBe("2.1.0");
  });

  test("ignores non-semver directories", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    mkdirSync(path.join(dir, "1.0.0"));
    mkdirSync(path.join(dir, "not-a-version"));
    mkdirSync(path.join(dir, "latest"));

    const result = getInstalledVersion(dir);
    expect(result).toBe("1.0.0");
  });

  test("returns null when directory is empty", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    const result = getInstalledVersion(dir);
    expect(result).toBeNull();
  });

  test("returns null when directory has only non-semver entries", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    mkdirSync(path.join(dir, "foo"));
    mkdirSync(path.join(dir, "bar"));

    const result = getInstalledVersion(dir);
    expect(result).toBeNull();
  });
});

describe("getReferencedVersions", () => {
  const CACHE_BASE = "/fake/cache";
  const VERSION_PATTERN = new RegExp(`${CACHE_BASE}/masseater-plugins/mutils/([\\d.]+)/`);

  test("returns empty map when no files exist", async () => {
    const result = await getReferencedVersions(["/nonexistent-file.md"], VERSION_PATTERN);
    expect(result.size).toBe(0);
  });

  test("extracts version from file content", async () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    const filePath = path.join(dir, "AGENTS.md");
    writeFileSync(filePath, `See ${CACHE_BASE}/masseater-plugins/mutils/2.0.0/skills/foo`);

    const result = await getReferencedVersions([filePath], VERSION_PATTERN);
    expect(result.size).toBe(1);
    expect(result.get(filePath)).toBe("2.0.0");
  });

  test("returns empty map when file has no version reference", async () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    const filePath = path.join(dir, "CLAUDE.md");
    writeFileSync(filePath, "No version reference here");

    const result = await getReferencedVersions([filePath], VERSION_PATTERN);
    expect(result.size).toBe(0);
  });

  test("handles multiple files with different versions", async () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    const file1 = path.join(dir, "AGENTS.md");
    const file2 = path.join(dir, "CLAUDE.md");
    writeFileSync(file1, `${CACHE_BASE}/masseater-plugins/mutils/1.0.0/skills`);
    writeFileSync(file2, `${CACHE_BASE}/masseater-plugins/mutils/2.0.0/hooks`);

    const result = await getReferencedVersions([file1, file2], VERSION_PATTERN);
    expect(result.size).toBe(2);
    expect(result.get(file1)).toBe("1.0.0");
    expect(result.get(file2)).toBe("2.0.0");
  });

  test("skips non-existent files in list", async () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    const existingFile = path.join(dir, "AGENTS.md");
    writeFileSync(existingFile, `${CACHE_BASE}/masseater-plugins/mutils/1.0.0/foo`);

    const result = await getReferencedVersions(["/nonexistent.md", existingFile], VERSION_PATTERN);
    expect(result.size).toBe(1);
    expect(result.get(existingFile)).toBe("1.0.0");
  });
});
