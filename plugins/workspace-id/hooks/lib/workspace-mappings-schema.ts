/**
 * workspace_mappings テーブルのスキーマ定義とアクセス。
 * hooks/entry/workspace-id-persist.ts（読み取り側）と skills/workspace-id/generate.ts（書き込み側）の単一ソース。
 */
import { existsSync } from "node:fs";
import path from "node:path";
import type { MutilsDB, MutilsTable, TableSchema } from "@r_masseater/cc-plugin-lib";

export type WorkspaceMapping = {
  id?: number;
  workspace_id: string;
  feature_name: string;
  created_at: string;
  /** workspace-id を生成したセッション。古いレコードと session 指定なしの生成では null */
  session_id?: string | null;
};

const WORKSPACE_MAPPINGS_SCHEMA = {
  columns: `
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		workspace_id TEXT NOT NULL UNIQUE,
		feature_name TEXT NOT NULL,
		created_at TEXT NOT NULL,
		session_id TEXT
	`,
  indexes: [
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_mappings_workspace_id ON workspace_mappings(workspace_id)",
  ],
} as const;

/** workspace_mappings テーブルで使う操作。読み取り側は findAll、書き込み側は upsert を使う */
type WorkspaceMappingsTable = Pick<MutilsTable<WorkspaceMapping>, "findAll" | "upsert">;

/** openWorkspaceMappings が DB に求める操作。MutilsDB はこれを満たす */
type WorkspaceMappingsDb = Pick<MutilsDB, "all" | "run"> & {
  table(name: string, schema: TableSchema): WorkspaceMappingsTable;
};

/**
 * workspace_mappings テーブルを開く。session_id 列が無い旧スキーマの DB には列を追加する
 *
 * @param db - 開いた MutilsDB
 * @returns workspace_mappings テーブル
 */
export function openWorkspaceMappings(db: WorkspaceMappingsDb): WorkspaceMappingsTable {
  const table = db.table("workspace_mappings", WORKSPACE_MAPPINGS_SCHEMA);
  const columns = db.all("PRAGMA table_info(workspace_mappings)");
  const hasSessionIdColumn = columns.some(
    (column) =>
      typeof column === "object" &&
      column !== null &&
      "name" in column &&
      column.name === "session_id",
  );
  if (!hasSessionIdColumn) {
    db.run("ALTER TABLE workspace_mappings ADD COLUMN session_id TEXT");
  }
  return table;
}

/**
 * リポジトリに workspace の置き場（.agents/）があるかを判定する。無ければ workspace-id を保存・復元しない
 *
 * @param gitRoot - findGitRoot が返したリポジトリのルート
 * @returns .agents/ があれば true
 */
export function hasAgentsDir(gitRoot: string): boolean {
  return existsSync(path.join(gitRoot, ".agents"));
}
