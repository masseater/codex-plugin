/**
 * task_events からセッションの未完了タスクを復元する。
 * hooks/entry/continue-open-tasks.ts（Stop 継続）と skills/task-history/query.ts（--open）が使う。
 */
import { HookLogger } from "@r_masseater/cc-plugin-lib";
import { asRecord } from "./json-value.js";
import type { TaskEvent } from "./task-events-schema.js";

export type OpenTask = { key: string; subject: string; status: string };

const CLOSED_STATUSES = new Set(["completed", "deleted"]);

const logger = HookLogger.fromFile(import.meta.filename);

function parseJson(text: string | null): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    // raw_input / raw_response は hook が JSON.stringify した値なので通常は壊れていない。
    // 壊れていた場合はそのイベントを読み飛ばすだけで、他のイベントからの復元に影響しない
    logger.debug(`Skipping unreadable task event JSON: ${String(error)}`);
    return null;
  }
}

function stringField(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return undefined;
}

/**
 * TaskCreate の応答からタスク ID を取り出す。応答の形が分からない場合は undefined
 *
 * @param response - raw_response を JSON として読んだ値
 * @returns タスク ID
 */
function extractCreatedTaskId(response: unknown): string | undefined {
  if (typeof response === "string") {
    return /#(\w+)/.exec(response)?.[1];
  }
  return taskIdOf(asRecord(response));
}

function taskIdOf(obj: Record<string, unknown>): string | undefined {
  return (
    stringField(asRecord(obj.task), "id") ?? stringField(obj, "id") ?? stringField(obj, "taskId")
  );
}

type TaskState = { subject: string | undefined; status: string };

/** イベントを古い順に適用して組み立てる、TodoWrite のリストとタスク ID ごとの最新状態 */
type OpenTaskState = { todos: OpenTask[]; tasks: Map<string, TaskState> };

function todoFromJson(value: unknown): OpenTask {
  const todo = asRecord(value);
  const content = stringField(todo, "content") ?? "";
  return {
    key: `todo:${content}`,
    subject: content,
    status: stringField(todo, "status") ?? "pending",
  };
}

// TodoWrite は最後の呼び出しの newTodos が現在のリスト
function applyTodoWrite(state: OpenTaskState, event: TaskEvent): void {
  const newTodos = asRecord(parseJson(event.raw_response)).newTodos;
  if (Array.isArray(newTodos)) state.todos = newTodos.map(todoFromJson);
}

function createdSubject(input: Record<string, unknown>, event: TaskEvent): string | undefined {
  return stringField(input, "subject") ?? event.subject ?? undefined;
}

function createdTaskKey(event: TaskEvent, subject: string | undefined): string {
  return extractCreatedTaskId(parseJson(event.raw_response)) ?? `subject:${subject ?? ""}`;
}

function applyTaskCreate(state: OpenTaskState, event: TaskEvent): void {
  const subject = createdSubject(asRecord(parseJson(event.raw_input)), event);
  state.tasks.set(createdTaskKey(event, subject), { subject, status: "pending" });
}

/**
 * TaskUpdate の入力を前回の状態に重ねる。入力に無い項目は前回の値を引き継ぐ。
 *
 * @param input - TaskUpdate の tool_input
 * @param prev - 同じタスク ID の前回の状態
 * @returns 更新後の状態
 */
function updatedTask(input: Record<string, unknown>, prev: TaskState | undefined): TaskState {
  const base = prev ?? { subject: undefined, status: "pending" };
  return {
    subject: stringField(input, "subject") ?? base.subject,
    status: stringField(input, "status") ?? base.status,
  };
}

function applyTaskUpdate(state: OpenTaskState, event: TaskEvent): void {
  const input = asRecord(parseJson(event.raw_input));
  const id = stringField(input, "taskId");
  if (!id) return;
  state.tasks.set(id, updatedTask(input, state.tasks.get(id)));
}

const EVENT_APPLIERS = new Map<string, (state: OpenTaskState, event: TaskEvent) => void>([
  ["TodoWrite", applyTodoWrite],
  ["TaskCreate", applyTaskCreate],
  ["TaskUpdate", applyTaskUpdate],
]);

function isOpen(task: OpenTask): boolean {
  return task.subject !== "" && !CLOSED_STATUSES.has(task.status);
}

/**
 * 1 セッション分の task_events（古い順）から、未完了のタスクを返す。
 * TodoWrite は最後の呼び出しの newTodos が現在のリスト。TaskCreate / TaskUpdate はタスク ID ごとに最新の状態を取る
 *
 * @param events - 同じセッションの task_events（created_at と id の昇順）
 * @returns 未完了のタスク
 */
export function openTasks(events: TaskEvent[]): OpenTask[] {
  const state: OpenTaskState = { todos: [], tasks: new Map() };
  for (const event of events) {
    EVENT_APPLIERS.get(event.tool_name)?.(state, event);
  }

  const fromTasks = [...state.tasks].map(([id, task]) => ({
    key: `task:${id}`,
    subject: task.subject ?? `タスク ${id}`,
    status: task.status,
  }));

  return [...state.todos, ...fromTasks].filter(isOpen);
}
