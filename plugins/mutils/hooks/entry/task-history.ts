#!/usr/bin/env bun
import { findGitRoot, HookLogger, MutilsDB, wrapRun } from "@r_masseater/cc-plugin-lib";
import { defineHook, runHook } from "cc-hooks-ts";
import { asRecord } from "../lib/json-value.js";
import { TASK_EVENTS_SCHEMA, type TaskEvent } from "../lib/task-events-schema.js";

using logger = HookLogger.fromFile(import.meta.filename);

export type Todo = {
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm: string;
};

export type TodoEvent = { eventType: string; subject: string; status: string };

/**
 * 1 つの todo について、前回の状態との差を表すイベントを作る。
 *
 * @param old - 前回の同じ内容の todo（無ければ新規）
 * @param todo - 今回の todo
 * @returns イベント。状態が変わっていなければ空
 */
function todoEvent(old: Todo | undefined, todo: Todo): TodoEvent[] {
  const change = { subject: todo.content, status: todo.status };
  if (!old) return [{ eventType: "todo_create", ...change }];
  if (old.status === todo.status) return [];
  return [{ eventType: todo.status === "completed" ? "todo_complete" : "todo_update", ...change }];
}

export function diffTodos(oldTodos: Todo[], newTodos: Todo[]): TodoEvent[] {
  const oldMap = new Map(oldTodos.map((todo) => [todo.content, todo]));
  return newTodos.flatMap((todo) => todoEvent(oldMap.get(todo.content), todo));
}

export function isTodoArray(value: unknown): value is Todo[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) => typeof item === "object" && item !== null && "content" in item && "status" in item,
    )
  );
}

export function extractString(obj: Record<string, unknown>, key: string): string | null {
  const val = obj[key];
  return typeof val === "string" ? val : null;
}

const TARGET_TOOLS: ReadonlySet<string> = new Set(["TodoWrite", "TaskCreate", "TaskUpdate"]);

/** task_events に保存する 1 件のうち、ツールごとに決まる部分 */
type EventFields = Pick<TaskEvent, "event_type" | "subject" | "status">;

/** task_events に保存する 1 件のうち、hook の呼び出しごとに共通の部分 */
type EventContext = Omit<TaskEvent, "id" | keyof EventFields>;

function todosOf(response: unknown, key: "oldTodos" | "newTodos"): Todo[] {
  const value = asRecord(response)[key];
  return isTodoArray(value) ? value : [];
}

/**
 * TodoWrite の前後の todo を比べ、変化をイベントにする。
 *
 * @param response - TodoWrite の tool_response
 * @returns 変化した todo のイベント
 */
function todoWriteEvents(response: unknown): EventFields[] {
  return diffTodos(todosOf(response, "oldTodos"), todosOf(response, "newTodos")).map((event) => ({
    event_type: event.eventType,
    subject: event.subject,
    status: event.status,
  }));
}

/**
 * TaskCreate / TaskUpdate の入力をイベントにする（入力の型は保証されないため防御的に読む）。
 *
 * @param toolName - TaskCreate か TaskUpdate
 * @param toolInput - tool_input
 * @returns 1 件のイベント
 */
function taskEvents(toolName: string, toolInput: unknown): EventFields[] {
  const input = asRecord(toolInput);
  return [
    {
      event_type: toolName === "TaskCreate" ? "task_create" : "task_update",
      subject: extractString(input, "subject") ?? extractString(input, "content"),
      status: extractString(input, "status"),
    },
  ];
}

function eventsFor(input: { tool_name: string; tool_input: unknown }): EventFields[] {
  if (input.tool_name !== "TodoWrite") return taskEvents(input.tool_name, input.tool_input);
  return todoWriteEvents("tool_response" in input ? input.tool_response : undefined);
}

function rawResponseOf(input: object): string {
  return "tool_response" in input ? (JSON.stringify(input.tool_response) ?? "") : "";
}

function persistEvents(gitRoot: string, events: EventFields[], context: EventContext): void {
  using db = MutilsDB.open(gitRoot);
  const table = db.table<TaskEvent>("task_events", TASK_EVENTS_SCHEMA);
  for (const event of events) {
    table.upsert({ ...context, ...event });
  }
}

/**
 * イベントを task_events に保存する。保存に失敗してもツール呼び出しは妨げない
 *
 * @param gitRoot - mutils DB のあるリポジトリ
 * @param events - 保存するイベント
 * @param input - PostToolUse 入力
 */
function recordEvents(
  gitRoot: string,
  events: EventFields[],
  input: { tool_name: string; tool_input: unknown; session_id: string },
): void {
  try {
    persistEvents(gitRoot, events, {
      tool_name: input.tool_name,
      session_id: input.session_id,
      project_path: gitRoot,
      raw_input: JSON.stringify(input.tool_input),
      raw_response: rawResponseOf(input),
      created_at: new Date().toISOString(),
    });
    logger.info(`Persisted ${events.length} ${input.tool_name} event(s)`);
  } catch (error) {
    // 履歴の記録は補助機能で、失敗しても元のツール呼び出しは成功している。
    // hook の失敗として伝えるとツールの結果を妨げるため、error ログに残して処理を続ける
    logger.error("Failed to persist task event", { err: error });
  }
}

const hook = defineHook({
  trigger: {
    PostToolUse: true,
  },
  run: wrapRun(logger, (context) => {
    const { input } = context;
    if (!TARGET_TOOLS.has(input.tool_name)) {
      return context.success({});
    }

    const gitRoot = findGitRoot(input.cwd);
    if (gitRoot === null) {
      logger.debug("Skipping: not a git repository");
      return context.success({});
    }

    const events = eventsFor(input);
    if (events.length === 0) {
      logger.debug("No todo changes detected");
      return context.success({});
    }

    recordEvents(gitRoot, events, input);
    return context.success({});
  }),
});

if (import.meta.main) {
  await runHook(hook);
}
