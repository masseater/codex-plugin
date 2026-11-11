/**
 * task_events テーブルのスキーマ定義。
 * hooks/entry/task-history.ts（書き込み側）と skills/task-history/query.ts（読み取り側）の単一ソース。
 */

export type TaskEvent = {
  id?: number;
  event_type: string;
  tool_name: string;
  subject: string | null;
  status: string | null;
  session_id: string;
  project_path: string;
  raw_input: string;
  raw_response: string | null;
  created_at: string;
};

export const TASK_EVENTS_SCHEMA = {
  columns: `
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		event_type TEXT NOT NULL,
		tool_name TEXT NOT NULL,
		subject TEXT,
		status TEXT,
		session_id TEXT NOT NULL,
		project_path TEXT NOT NULL,
		raw_input TEXT NOT NULL,
		raw_response TEXT,
		created_at TEXT NOT NULL
	`,
  indexes: [
    "CREATE INDEX IF NOT EXISTS idx_task_events_session ON task_events(session_id)",
    "CREATE INDEX IF NOT EXISTS idx_task_events_created ON task_events(created_at)",
  ],
} as const;
