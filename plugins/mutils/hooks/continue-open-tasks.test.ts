import { describe, expect, test, vi } from "vite-plus/test";

// MutilsDB は bun:sqlite に依存するため vitest では開けない。open をモックし、テーブルの偽物を返す
const { openMutilsDb } = vi.hoisted(() => ({ openMutilsDb: vi.fn() }));

vi.mock("@r_masseater/cc-plugin-lib", () => ({
  HookLogger: {
    fromFile: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      [Symbol.dispose]: vi.fn(),
    }),
  },
  wrapRun: vi.fn((_logger: unknown, fn: unknown) => fn),
  findGitRoot: vi.fn(),
  MutilsDB: { open: openMutilsDb },
}));
vi.mock("./lib/notification.ts", () => ({ notifyTurnEnd: vi.fn() }));
vi.mock("cc-hooks-ts", () => ({
  defineHook: vi.fn((opts: { run: (ctx: unknown) => unknown }) => opts),
  runHook: vi.fn(),
}));

import { findGitRoot } from "@r_masseater/cc-plugin-lib";
import {
  decideContinuation,
  hook,
  formatContinuation,
  isWaitingOnBackground,
  MAX_CONTINUATIONS,
  openKey,
} from "./entry/continue-open-tasks.ts";
import { notifyTurnEnd } from "./lib/notification.ts";
import { openTasks } from "./lib/open-tasks.ts";
import type { TaskEvent } from "./lib/task-events-schema.ts";

function event(
  toolName: string,
  input: unknown,
  response: unknown = null,
  subject: string | null = null,
): TaskEvent {
  return {
    event_type: "x",
    tool_name: toolName,
    subject,
    status: null,
    session_id: "s",
    project_path: "/p",
    raw_input: JSON.stringify(input),
    raw_response: response === null ? null : JSON.stringify(response),
    created_at: "2026-01-01T00:00:00Z",
  };
}

describe("openTasks", () => {
  test("uses the latest TodoWrite list", () => {
    const events = [
      event("TodoWrite", {}, { newTodos: [{ content: "a", status: "pending" }] }),
      event(
        "TodoWrite",
        {},
        {
          newTodos: [
            { content: "a", status: "completed" },
            { content: "b", status: "in_progress" },
          ],
        },
      ),
    ];
    expect(openTasks(events).map((t) => t.subject)).toEqual(["b"]);
  });

  test("tracks TaskCreate / TaskUpdate by task id", () => {
    const events = [
      event("TaskCreate", { subject: "write tests" }, { task: { id: "1" } }),
      event("TaskCreate", { subject: "update docs" }, { task: { id: "2" } }),
      event("TaskUpdate", { taskId: "1", status: "completed" }),
      event("TaskUpdate", { taskId: "2", status: "in_progress" }),
    ];
    expect(openTasks(events)).toEqual([
      { key: "task:2", subject: "update docs", status: "in_progress" },
    ]);
  });

  test("treats deleted tasks as closed", () => {
    const events = [
      event("TaskCreate", { subject: "x" }, { task: { id: "1" } }),
      event("TaskUpdate", { taskId: "1", status: "deleted" }),
    ];
    expect(openTasks(events)).toEqual([]);
  });

  test("ignores broken JSON", () => {
    const broken = { ...event("TodoWrite", {}), raw_response: "{" };
    expect(openTasks([broken])).toEqual([]);
  });
});

describe("TaskCreate の応答からのタスク ID の読み取り", () => {
  test("reads id from several response shapes", () => {
    const keys = openTasks([
      event("TaskCreate", { subject: "a" }, { task: { id: "3" } }),
      event("TaskCreate", { subject: "b" }, { id: 4 }),
      event("TaskCreate", { subject: "c" }, "Task #5 created"),
      event("TaskCreate", { subject: "d" }, null),
    ]).map((task) => task.key);
    expect(keys).toEqual(["task:3", "task:4", "task:5", "task:subject:d"]);
  });
});

describe("decideContinuation", () => {
  const open = [{ key: "todo:a", subject: "a", status: "pending" }];

  test("does not continue when nothing is open", () => {
    expect(decideContinuation([], { open_key: "k", count: 1 })).toEqual({
      continue: false,
      next: undefined,
    });
  });

  test("continues up to MAX_CONTINUATIONS times for the same open items", () => {
    let state: { open_key: string; count: number } | undefined;
    const results: boolean[] = [];
    for (let i = 0; i < MAX_CONTINUATIONS + 2; i++) {
      const decision = decideContinuation(open, state);
      results.push(decision.continue);
      state = decision.next;
    }
    expect(results).toEqual([true, true, false, false]);
  });

  test("resets the counter when the open items change", () => {
    const prev = { open_key: openKey(open), count: MAX_CONTINUATIONS };
    const changed = [{ key: "todo:b", subject: "b", status: "pending" }];
    expect(decideContinuation(changed, prev)).toEqual({
      continue: true,
      next: { open_key: "todo:b", count: 1 },
    });
  });
});

describe("formatContinuation", () => {
  test("names each open item", () => {
    const text = formatContinuation([
      { key: "todo:a", subject: "write tests", status: "pending" },
      { key: "todo:b", subject: "update docs", status: "in_progress" },
    ]);
    expect(text).toContain("write tests（pending）");
    expect(text).toContain("update docs（in_progress）");
  });
});

describe("isWaitingOnBackground", () => {
  test("is false when both arrays are empty or absent", () => {
    expect(isWaitingOnBackground({})).toBe(false);
    expect(isWaitingOnBackground({ background_tasks: [], session_crons: [] })).toBe(false);
  });

  test("is true while a background task is in flight", () => {
    expect(isWaitingOnBackground({ background_tasks: [{ id: "b1" }] })).toBe(true);
  });

  test("is true while a wakeup is scheduled", () => {
    expect(isWaitingOnBackground({ session_crons: [{ id: "c1" }] })).toBe(true);
  });
});

describe("formatContinuation wording", () => {
  test("allows stopping when the turn waits for approval or an answer", () => {
    expect(formatContinuation([{ key: "todo:a", subject: "a", status: "pending" }])).toContain(
      "そのまま止めてよい",
    );
  });
});

const ctx = () => ({
  input: {
    cwd: "/repo",
    session_id: "s",
    hook_event_name: "Stop" as const,
    transcript_path: "/tmp/transcript",
    stop_hook_active: false,
    last_assistant_message: "done",
  },
  success: vi.fn(),
  json: vi.fn(),
  blockingError: vi.fn(),
  nonBlockingError: vi.fn(),
  defer: vi.fn(),
});
const run = (c: ReturnType<typeof ctx>) => hook.run(c);

const mockDb = (events: TaskEvent[]) => {
  const table = {
    findAll: vi.fn(() => events),
    findOne: vi.fn(() => undefined),
    upsert: vi.fn(),
    delete: vi.fn(),
  };
  openMutilsDb.mockReturnValue({
    table: () => table,
    [Symbol.dispose]: vi.fn(),
  });
};

describe("hook run: notification only when the turn really ends", () => {
  test("notifies when there is nothing to continue", async () => {
    vi.mocked(notifyTurnEnd).mockClear();
    vi.mocked(findGitRoot).mockReturnValue(null);
    const c = ctx();
    await run(c);
    expect(notifyTurnEnd).toHaveBeenCalledTimes(1);
    expect(c.success).toHaveBeenCalledWith({});
    expect(c.json).not.toHaveBeenCalled();
  });

  test("does not notify when the turn is continued for open tasks", async () => {
    vi.mocked(notifyTurnEnd).mockClear();
    vi.mocked(findGitRoot).mockReturnValue("/repo");
    mockDb([event("TodoWrite", {}, { newTodos: [{ content: "a", status: "pending" }] })]);
    const c = ctx();
    await run(c);
    expect(notifyTurnEnd).not.toHaveBeenCalled();
    expect(c.json).toHaveBeenCalledTimes(1);
  });

  test("keeps going when the notification fails", async () => {
    vi.mocked(notifyTurnEnd).mockImplementationOnce(() => {
      throw new Error("boom");
    });
    vi.mocked(findGitRoot).mockReturnValue(null);
    const c = ctx();
    // 通知が例外を投げても hook は例外を外へ出さずに success を返す
    await run(c);
    expect(c.success).toHaveBeenCalledWith({});
  });
});

describe("openTasks edge cases", () => {
  test("falls back to the event subject, then to a generated name", () => {
    const keys = openTasks([
      event("TaskCreate", {}, { id: 1 }, "from event"),
      event("TaskUpdate", { taskId: "9", status: "in_progress" }),
    ]).map((task) => [task.key, task.subject]);
    expect(keys).toEqual([
      ["task:1", "from event"],
      ["task:9", "タスク 9"],
    ]);
  });

  test("ignores a TaskUpdate without taskId and keeps the previous subject on update", () => {
    const tasks = openTasks([
      event("TaskCreate", { subject: "keep" }, { id: "1" }),
      event("TaskUpdate", { status: "completed" }),
      event("TaskUpdate", { taskId: "1", status: "in_progress" }),
    ]);
    expect(tasks).toEqual([{ key: "task:1", subject: "keep", status: "in_progress" }]);
  });

  test("renames a task when TaskUpdate carries a subject", () => {
    const tasks = openTasks([
      event("TaskCreate", { subject: "old" }, { id: "1" }),
      event("TaskUpdate", { taskId: "1", subject: "new" }),
    ]);
    expect(tasks.map((task) => task.subject)).toEqual(["new"]);
  });

  test("reads TodoWrite items with missing fields and drops blank ones", () => {
    const tasks = openTasks([
      event("TodoWrite", {}, { newTodos: [{ content: "a" }, { status: "pending" }, "x"] }),
    ]);
    expect(tasks).toEqual([{ key: "todo:a", subject: "a", status: "pending" }]);
  });

  test("ignores events of other tools and a TodoWrite without newTodos", () => {
    expect(openTasks([event("Bash", {}), event("TodoWrite", {}, { newTodos: "x" })])).toEqual([]);
  });
});
