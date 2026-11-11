import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { getKnowledgeRoot, normalizeName, resolveKnowledgeDir } from "./resolve-knowledge-dir.js";

describe("normalizeName", () => {
  test("strips leading @ and replaces / with -", () => {
    expect(normalizeName("@octokit/rest")).toBe("octokit-rest");
  });

  test("returns plain name unchanged", () => {
    expect(normalizeName("express")).toBe("express");
  });

  test("handles scoped package with nested path", () => {
    expect(normalizeName("@babel/core")).toBe("babel-core");
  });

  test("handles name with multiple slashes", () => {
    expect(normalizeName("@scope/a/b")).toBe("scope-a-b");
  });

  test("handles name without @ but with slash", () => {
    expect(normalizeName("some/path")).toBe("some-path");
  });

  test("handles empty string", () => {
    expect(normalizeName("")).toBe("");
  });
});

describe("getKnowledgeRoot", () => {
  test("returns project-local path when user=false", () => {
    const result = getKnowledgeRoot(false);
    expect(result).toBe(join(process.cwd(), ".claude", "skills", "library-knowledge"));
  });

  test("returns user-level path when user=true", () => {
    const { homedir } = require("node:os");
    const result = getKnowledgeRoot(true);
    expect(result).toBe(join(homedir(), ".claude", "skills", "library-knowledge"));
  });
});

describe("resolveKnowledgeDir", () => {
  const testTmpDir = join(tmpdir(), `resolve-knowledge-dir-test-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(testTmpDir, { recursive: true });
    vi.spyOn(process, "cwd").mockReturnValue(testTmpDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(testTmpDir, { recursive: true, force: true });
  });

  test("creates library directory if it does not exist", () => {
    const dir = resolveKnowledgeDir("express", false);
    const expected = join(testTmpDir, ".claude", "skills", "library-knowledge", "express");
    expect(dir).toBe(expected);
    expect(existsSync(dir)).toBe(true);
  });

  test("creates SKILL.md in knowledge root if missing", () => {
    resolveKnowledgeDir("react", false);
    const skillMdPath = join(testTmpDir, ".claude", "skills", "library-knowledge", "SKILL.md");
    expect(existsSync(skillMdPath)).toBe(true);
    const content = readFileSync(skillMdPath, "utf-8");
    expect(content).toContain("Library Knowledge Base");
    expect(content).toContain("description:");
  });

  test("does not overwrite existing SKILL.md", () => {
    const root = join(testTmpDir, ".claude", "skills", "library-knowledge");
    mkdirSync(root, { recursive: true });
    const skillMdPath = join(root, "SKILL.md");
    const existingContent = "# Existing Content";
    require("node:fs").writeFileSync(skillMdPath, existingContent, "utf-8");

    resolveKnowledgeDir("lodash", false);

    const content = readFileSync(skillMdPath, "utf-8");
    expect(content).toBe(existingContent);
  });

  test("normalizes scoped package names for directory", () => {
    const dir = resolveKnowledgeDir("@octokit/rest", false);
    expect(dir).toContain("octokit-rest");
    expect(existsSync(dir)).toBe(true);
  });

  test("returns existing directory without error", () => {
    const dir1 = resolveKnowledgeDir("express", false);
    const dir2 = resolveKnowledgeDir("express", false);
    expect(dir1).toBe(dir2);
    expect(existsSync(dir1)).toBe(true);
  });
});
