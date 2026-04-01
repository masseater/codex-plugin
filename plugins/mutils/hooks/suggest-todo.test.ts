import { afterEach, describe, expect, test } from "vitest";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Tests for the pure helper logic in suggest-todo.ts.
 * The functions are not exported, so we replicate them here.
 */

type StatusItem = {
  status: "pending" | "in_progress" | "completed";
};

function findJsonFiles(dir: string, predicate: (filename: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(predicate)
    .map((f) => path.join(dir, f));
}

function parseJsonFiles<T>(filePaths: string[], transform: (parsed: unknown) => T[]): T[] {
  const items: T[] = [];
  for (const filePath of filePaths) {
    try {
      const content = readFileSync(filePath, "utf-8");
      items.push(...transform(JSON.parse(content)));
    } catch {
      // skip parse failures
    }
  }
  return items;
}

function createTmpDir(): string {
  const dir = path.join(
    tmpdir(),
    `suggest-todo-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

describe("findJsonFiles", () => {
  test("returns empty array for non-existent directory", () => {
    const result = findJsonFiles("/nonexistent-dir-12345", () => true);
    expect(result).toStrictEqual([]);
  });

  test("returns matching files with full paths", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);
    writeFileSync(path.join(dir, "session1-agent-0.json"), "[]");
    writeFileSync(path.join(dir, "session1-agent-1.json"), "[]");
    writeFileSync(path.join(dir, "session2-agent-0.json"), "[]");

    const result = findJsonFiles(
      dir,
      (f) => f.startsWith("session1-agent-") && f.endsWith(".json"),
    );
    expect(result).toHaveLength(2);
    expect(result.every((f) => f.startsWith(dir))).toBe(true);
    expect(result.every((f) => path.basename(f).startsWith("session1-agent-"))).toBe(true);
  });

  test("returns empty array when no files match predicate", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);
    writeFileSync(path.join(dir, "other.txt"), "data");

    const result = findJsonFiles(dir, (f) => f.endsWith(".json"));
    expect(result).toStrictEqual([]);
  });
});

describe("parseJsonFiles", () => {
  test("parses valid JSON files and transforms them", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    const items: StatusItem[] = [{ status: "pending" }, { status: "completed" }];
    const filePath = path.join(dir, "data.json");
    writeFileSync(filePath, JSON.stringify(items));

    const result = parseJsonFiles<StatusItem>([filePath], (parsed) =>
      Array.isArray(parsed) ? parsed : [],
    );
    expect(result).toStrictEqual(items);
  });

  test("skips files with invalid JSON", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    const validPath = path.join(dir, "valid.json");
    const invalidPath = path.join(dir, "invalid.json");
    writeFileSync(validPath, JSON.stringify([{ status: "pending" }]));
    writeFileSync(invalidPath, "not valid json");

    const result = parseJsonFiles<StatusItem>([invalidPath, validPath], (parsed) =>
      Array.isArray(parsed) ? parsed : [],
    );
    expect(result).toStrictEqual([{ status: "pending" }]);
  });

  test("returns empty array for empty file list", () => {
    const result = parseJsonFiles<StatusItem>([], (parsed) =>
      Array.isArray(parsed) ? parsed : [],
    );
    expect(result).toStrictEqual([]);
  });

  test("handles task-style transform", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);

    const filePath = path.join(dir, "task.json");
    writeFileSync(filePath, JSON.stringify({ id: "t1", status: "pending" }));

    const result = parseJsonFiles<StatusItem>([filePath], (parsed) => {
      const task = parsed as Record<string, unknown>;
      return task.id && task.status ? [task as StatusItem] : [];
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe("pending");
  });
});
