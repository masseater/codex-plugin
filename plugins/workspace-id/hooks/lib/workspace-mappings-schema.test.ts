import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { hasAgentsDir, openWorkspaceMappings } from "./workspace-mappings-schema.ts";

// MutilsDB は bun:sqlite に依存するため、vitest では必要なメソッドだけの偽物を使う
function fakeDb(columns: unknown[]) {
  const table = { findAll: vi.fn(), upsert: vi.fn() };
  const db = {
    table: vi.fn(() => table),
    all: vi.fn(() => columns),
    run: vi.fn(),
  };
  return { db, table };
}

describe("openWorkspaceMappings", () => {
  test("returns the table without altering when session_id column exists", () => {
    const { db, table } = fakeDb([{ name: "id" }, { name: "session_id" }]);

    expect(openWorkspaceMappings(db)).toBe(table);
    expect(db.table).toHaveBeenCalledWith(
      "workspace_mappings",
      expect.objectContaining({ columns: expect.stringContaining("session_id TEXT") }),
    );
    expect(db.all).toHaveBeenCalledWith("PRAGMA table_info(workspace_mappings)");
    expect(db.run).not.toHaveBeenCalled();
  });

  test("adds the session_id column to an old-schema table", () => {
    const { db } = fakeDb([{ name: "id" }, { name: "workspace_id" }]);

    openWorkspaceMappings(db);

    expect(db.run).toHaveBeenCalledWith(
      "ALTER TABLE workspace_mappings ADD COLUMN session_id TEXT",
    );
  });

  test("ignores malformed column rows and adds the column", () => {
    const { db } = fakeDb([null, "session_id", { other: 1 }]);

    openWorkspaceMappings(db);

    expect(db.run).toHaveBeenCalledTimes(1);
  });
});

describe("hasAgentsDir", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    dirs.length = 0;
  });

  function makeRoot(): string {
    const dir = mkdtempSync(path.join(tmpdir(), "workspace-id-schema-"));
    dirs.push(dir);
    return dir;
  }

  test("is true when .agents exists", () => {
    const root = makeRoot();
    mkdirSync(path.join(root, ".agents"));
    expect(hasAgentsDir(root)).toBe(true);
  });

  test("is false when .agents is missing", () => {
    expect(hasAgentsDir(makeRoot())).toBe(false);
  });
});
