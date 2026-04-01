#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { findGitRoot, MutilsDB } from "@r_masseater/cc-plugin-lib";

type TaskEvent = {
  id: number;
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

const TASK_EVENTS_SCHEMA = {
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

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    recent: { type: "string", default: "50" },
    session: { type: "string" },
    status: { type: "string" },
    since: { type: "string" },
  },
});

const gitRoot = findGitRoot(process.cwd());
if (!gitRoot) {
  console.error("Error: Not in a git repository");
  process.exit(1);
}

using db = MutilsDB.open(gitRoot);
const table = db.table<TaskEvent>("task_events", TASK_EVENTS_SCHEMA);

const conditions: string[] = [];
const params: (string | number)[] = [];

if (values.session) {
  conditions.push("session_id = ?");
  params.push(values.session);
}

if (values.status) {
  conditions.push("status = ?");
  params.push(values.status);
}

if (values.since) {
  conditions.push("created_at >= ?");
  params.push(values.since);
}

const limit = Number.parseInt(values.recent ?? "50", 10);
const where = conditions.length > 0 ? conditions.join(" AND ") : "1=1";
const events = table.findAll(`${where} ORDER BY created_at DESC LIMIT ?`, [...params, limit]);

if (events.length === 0) {
  console.log("No task events found.");
  process.exit(0);
}

// Group by session
const bySession = new Map<string, TaskEvent[]>();
for (const event of events) {
  const group = bySession.get(event.session_id) ?? [];
  group.push(event);
  bySession.set(event.session_id, group);
}

const statusIcon: Record<string, string> = {
  pending: "[ ]",
  in_progress: "[~]",
  completed: "[x]",
};

console.log(`# Task History (${events.length} events)\n`);

for (const [sessionId, sessionEvents] of bySession) {
  const shortId = sessionId.slice(0, 12);
  const firstDate = sessionEvents.at(-1)?.created_at.slice(0, 10) ?? "";
  console.log(`## Session ${shortId}... (${firstDate})\n`);

  // Show in chronological order within session
  for (const event of sessionEvents.toReversed()) {
    const time = event.created_at.slice(11, 19);
    const icon = statusIcon[event.status ?? ""] ?? "[-]";
    const subject = event.subject ?? "(no subject)";
    const eventLabel = event.event_type.replace("_", " ");
    console.log(`- ${icon} \`${time}\` **${eventLabel}**: ${subject}`);
  }
  console.log();
}
