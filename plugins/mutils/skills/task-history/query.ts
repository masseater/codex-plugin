#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { findGitRoot, MutilsDB } from "@r_masseater/cc-plugin-lib";
import { asRecord } from "../../hooks/lib/json-value.js";
import { openTasks } from "../../hooks/lib/open-tasks.js";
import {
  TASK_EVENTS_SCHEMA,
  type TaskEvent as TaskEventBase,
} from "../../hooks/lib/task-events-schema.js";

// クエリ結果は常に DB に保存済みの行のため、id は必須
type TaskEvent = TaskEventBase & { id: number };

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    recent: { type: "string", default: "50" },
    session: { type: "string" },
    status: { type: "string" },
    since: { type: "string" },
    open: { type: "boolean", default: false },
  },
});

const gitRoot = findGitRoot(process.cwd());
if (!gitRoot) {
  console.error("Error: Not in a git repository");
  process.exit(1);
}

using db = MutilsDB.open(gitRoot);
const table = db.table<TaskEvent>("task_events", TASK_EVENTS_SCHEMA);

if (values.open) {
  printOpenTasks();
  process.exit(0);
}

/**
 * 最近更新されたセッションの ID を新しい順に返す
 *
 * @param limit - 返すセッションの数
 * @returns セッション ID
 */
function recentSessionIds(limit: number): string[] {
  return db
    .all(
      "SELECT session_id FROM task_events GROUP BY session_id ORDER BY MAX(created_at) DESC LIMIT ?",
      [limit],
    )
    .flatMap((row) => {
      const sessionId = asRecord(row).session_id;
      return typeof sessionId === "string" ? [sessionId] : [];
    });
}

function sessionIdsToShow(): string[] {
  return values.session
    ? [values.session]
    : recentSessionIds(Number.parseInt(values.recent ?? "50", 10));
}

/**
 * 1 セッションの未完了タスクを出す
 *
 * @param sessionId - 対象のセッション
 * @returns 未完了タスクがあって出力したなら true
 */
function printSessionOpenTasks(sessionId: string): boolean {
  const sessionEvents = table.findAll("session_id = ? ORDER BY created_at, id", [sessionId]);
  const open = openTasks(sessionEvents);
  if (open.length === 0) return false;
  const lastDate = sessionEvents.at(-1)?.created_at.slice(0, 16) ?? "";
  console.log(`## Session ${sessionId} (last update ${lastDate})\n`);
  for (const task of open) console.log(`- [${task.status}] ${task.subject}`);
  console.log();
  return true;
}

// セッションごとに未完了のタスクを出す（直近のセッションから --recent 件）
function printOpenTasks(): void {
  let printed = 0;
  for (const sessionId of sessionIdsToShow()) {
    if (printSessionOpenTasks(sessionId)) printed++;
  }
  if (printed === 0) console.log("No open tasks found.");
}

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
