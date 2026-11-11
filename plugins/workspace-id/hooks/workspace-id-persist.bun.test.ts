import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { MutilsDB } from "@r_masseater/cc-plugin-lib";
import { afterEach, describe, expect, test } from "bun:test";
import { getLatestWorkspaceMapping } from "./entry/workspace-id-persist.ts";
import { openWorkspaceMappings } from "./lib/workspace-mappings-schema.ts";

// MutilsDB は bun:sqlite に依存するため、このテストは Bun ランタイムで実行する
// （*.bun.test.ts は vitest.config.ts で除外し、`bun test` 側で実行する規約。
// plugins/github-workflow/lib/issue-db/db.bun.test.ts と同じ規約）。

const tmpDirs: string[] = [];

function createTmpDir(): string {
  const dir = path.join(
    tmpdir(),
    `workspace-id-persist-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  tmpDirs.push(dir);
  return dir;
}

function insert(cwd: string, rows: { id: string; session: string | null }[]): void {
  using db = MutilsDB.open(cwd);
  const table = openWorkspaceMappings(db);
  for (const row of rows) {
    table.upsert({
      workspace_id: row.id,
      feature_name: "feature",
      created_at: "2026-07-01T00:00:00Z",
      session_id: row.session,
    });
  }
}

afterEach(() => {
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

describe("getLatestWorkspaceMapping", () => {
  test("returns null when the DB has no rows", () => {
    expect(getLatestWorkspaceMapping(createTmpDir(), "s1")).toBeNull();
  });

  test("returns the latest row of the given session only", () => {
    const cwd = createTmpDir();
    insert(cwd, [
      { id: "ws-001", session: "s1" },
      { id: "ws-002", session: "s1" },
      { id: "ws-003", session: "s2" },
    ]);

    expect(getLatestWorkspaceMapping(cwd, "s1")?.workspace_id).toBe("ws-002");
    expect(getLatestWorkspaceMapping(cwd, "s2")?.workspace_id).toBe("ws-003");
  });

  test("does not restore a row from another session or without a session", () => {
    const cwd = createTmpDir();
    insert(cwd, [
      { id: "ws-001", session: null },
      { id: "ws-002", session: "other" },
    ]);

    expect(getLatestWorkspaceMapping(cwd, "s1")).toBeNull();
  });

  test("migrates a table created with the old schema", () => {
    const cwd = createTmpDir();
    {
      using db = MutilsDB.open(cwd);
      db.run(
        "CREATE TABLE workspace_mappings (id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id TEXT NOT NULL UNIQUE, feature_name TEXT NOT NULL, created_at TEXT NOT NULL)",
      );
      db.run(
        "INSERT INTO workspace_mappings (workspace_id, feature_name, created_at) VALUES ('old', 'f', 't')",
      );
    }
    insert(cwd, [{ id: "ws-new", session: "s1" }]);

    expect(getLatestWorkspaceMapping(cwd, "s1")?.workspace_id).toBe("ws-new");
  });
});
