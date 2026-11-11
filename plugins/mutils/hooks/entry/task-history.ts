#!/usr/bin/env bun
import { findGitRoot, HookLogger, MutilsDB, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";

using logger = HookLogger.fromFile(import.meta.filename);

type TaskEvent = {
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

type Todo = {
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm: string;
};

function diffTodos(
  oldTodos: Todo[],
  newTodos: Todo[],
): { eventType: string; subject: string; status: string }[] {
  const events: { eventType: string; subject: string; status: string }[] = [];

  const oldMap = new Map<string, Todo>();
  for (const todo of oldTodos) {
    oldMap.set(todo.content, todo);
  }

  for (const newTodo of newTodos) {
    const old = oldMap.get(newTodo.content);
    if (!old) {
      events.push({
        eventType: "todo_create",
        subject: newTodo.content,
        status: newTodo.status,
      });
    } else if (old.status !== newTodo.status) {
      events.push({
        eventType: newTodo.status === "completed" ? "todo_complete" : "todo_update",
        subject: newTodo.content,
        status: newTodo.status,
      });
    }
  }

  return events;
}

function isTodoArray(value: unknown): value is Todo[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) => typeof item === "object" && item !== null && "content" in item && "status" in item,
    )
  );
}

function extractString(obj: Record<string, unknown>, key: string): string | null {
  const val = obj[key];
  return typeof val === "string" ? val : null;
}

const hook = defineHook({
  trigger: {
    PostToolUse: true,
  },
  run: wrapRun(logger, (context) => {
    const toolName = context.input.tool_name;

    const targetTools = ["TodoWrite", "TaskCreate", "TaskUpdate"];
    if (!targetTools.includes(toolName)) {
      return context.success({});
    }

    const gitRoot = findGitRoot(context.input.cwd);
    if (gitRoot === null) {
      logger.debug("Skipping: not a git repository");
      return context.success({});
    }

    const sessionId = context.input.session_id;
    const now = new Date().toISOString();
    const rawInput = JSON.stringify(context.input.tool_input);
    const rawResponse =
      "tool_response" in context.input ? JSON.stringify(context.input.tool_response) : null;

    try {
      using db = MutilsDB.open(gitRoot);
      const table = db.table<TaskEvent>("task_events", TASK_EVENTS_SCHEMA);

      if (toolName === "TodoWrite") {
        const response = context.input.tool_response;
        const oldTodos =
          typeof response === "object" &&
          response !== null &&
          "oldTodos" in response &&
          isTodoArray(response.oldTodos)
            ? response.oldTodos
            : [];
        const newTodos =
          typeof response === "object" &&
          response !== null &&
          "newTodos" in response &&
          isTodoArray(response.newTodos)
            ? response.newTodos
            : [];

        const events = diffTodos(oldTodos, newTodos);
        if (events.length === 0) {
          logger.debug("No todo changes detected");
          return context.success({});
        }

        for (const event of events) {
          table.upsert({
            event_type: event.eventType,
            tool_name: toolName,
            subject: event.subject,
            status: event.status,
            session_id: sessionId,
            project_path: gitRoot,
            raw_input: rawInput,
            raw_response: rawResponse ?? "",
            created_at: now,
          });
        }

        logger.info(`Persisted ${events.length} todo event(s)`);
      } else {
        // TaskCreate / TaskUpdate (untyped, defensive access)
        const input =
          typeof context.input.tool_input === "object" && context.input.tool_input !== null
            ? (context.input.tool_input as Record<string, unknown>)
            : {};
        const subject = extractString(input, "subject") ?? extractString(input, "content") ?? null;
        const status = extractString(input, "status") ?? null;
        const eventType = toolName === "TaskCreate" ? "task_create" : "task_update";

        table.upsert({
          event_type: eventType,
          tool_name: toolName,
          subject,
          status,
          session_id: sessionId,
          project_path: gitRoot,
          raw_input: rawInput,
          raw_response: rawResponse ?? "",
          created_at: now,
        });

        logger.info(`Persisted ${eventType} event: ${subject ?? "(no subject)"}`);
      }
    } catch (error) {
      logger.error(`Failed to persist task event: ${error}`);
    }

    return context.success({});
  }),
});

if (import.meta.main) {
  await runHook(hook);
}
