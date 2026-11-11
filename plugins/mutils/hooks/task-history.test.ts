import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { findGitRoot } from "@r_masseater/cc-plugin-lib";
import { type CapturedHook, hookContext } from "../__tests__/hook-context.ts";

vi.mock("@r_masseater/cc-plugin-lib", () => ({
  HookLogger: {
    fromFile: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      [Symbol.dispose]: vi.fn(),
    }),
  },
  wrapRun: vi.fn((_logger: unknown, fn: unknown) => fn),
  findGitRoot: vi.fn(),
  MutilsDB: { open: dbOpen },
}));
const dbOpen = vi.hoisted(() => vi.fn());
const captured = vi.hoisted(() => ({ hook: undefined as CapturedHook | undefined }));
vi.mock("cc-hooks-ts", () => ({
  defineHook: vi.fn((opts: CapturedHook) => {
    captured.hook = opts;
    return opts;
  }),
  runHook: vi.fn(),
}));

import { diffTodos, extractString, isTodoArray } from "./entry/task-history.ts";

type Todo = {
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm: string;
};

function todo(content: string, status: Todo["status"]): Todo {
  return { content, status, activeForm: content };
}

describe("diffTodos", () => {
  test("emits todo_create for a brand-new todo", () => {
    const events = diffTodos([], [todo("write tests", "pending")]);
    expect(events).toEqual([
      { eventType: "todo_create", subject: "write tests", status: "pending" },
    ]);
  });

  test("emits todo_update when status changes to in_progress", () => {
    const events = diffTodos(
      [todo("write tests", "pending")],
      [todo("write tests", "in_progress")],
    );
    expect(events).toEqual([
      { eventType: "todo_update", subject: "write tests", status: "in_progress" },
    ]);
  });

  test("emits todo_complete when status changes to completed", () => {
    const events = diffTodos(
      [todo("write tests", "in_progress")],
      [todo("write tests", "completed")],
    );
    expect(events).toEqual([
      { eventType: "todo_complete", subject: "write tests", status: "completed" },
    ]);
  });

  test("emits no event when status is unchanged", () => {
    const events = diffTodos([todo("write tests", "pending")], [todo("write tests", "pending")]);
    expect(events).toEqual([]);
  });

  test("emits multiple events for multiple changed todos", () => {
    const events = diffTodos(
      [todo("a", "pending"), todo("b", "in_progress")],
      [todo("a", "in_progress"), todo("b", "completed"), todo("c", "pending")],
    );
    expect(events).toEqual([
      { eventType: "todo_update", subject: "a", status: "in_progress" },
      { eventType: "todo_complete", subject: "b", status: "completed" },
      { eventType: "todo_create", subject: "c", status: "pending" },
    ]);
  });

  test("emits nothing for todos removed between old and new (not present in new)", () => {
    const events = diffTodos([todo("a", "pending"), todo("b", "pending")], [todo("a", "pending")]);
    expect(events).toEqual([]);
  });

  test("returns empty array when both lists are empty", () => {
    expect(diffTodos([], [])).toEqual([]);
  });
});

describe("isTodoArray", () => {
  test("returns true for a valid todo array", () => {
    expect(isTodoArray([todo("a", "pending")])).toBe(true);
  });

  test("returns true for an empty array", () => {
    expect(isTodoArray([])).toBe(true);
  });

  test("returns false for a non-array value", () => {
    expect(isTodoArray({ content: "a", status: "pending" })).toBe(false);
  });

  test("returns false for null", () => {
    expect(isTodoArray(null)).toBe(false);
  });

  test("returns false for an array with items missing 'content'", () => {
    expect(isTodoArray([{ status: "pending" }])).toBe(false);
  });

  test("returns false for an array with items missing 'status'", () => {
    expect(isTodoArray([{ content: "a" }])).toBe(false);
  });

  test("returns false for an array containing a non-object item", () => {
    expect(isTodoArray(["not an object"])).toBe(false);
  });

  test("returns false for an array containing null", () => {
    expect(isTodoArray([null])).toBe(false);
  });
});

describe("extractString", () => {
  test("returns the string value when the key exists and is a string", () => {
    expect(extractString({ subject: "hello" }, "subject")).toBe("hello");
  });

  test("returns null when the key does not exist", () => {
    expect(extractString({}, "subject")).toBeNull();
  });

  test("returns null when the value is not a string", () => {
    expect(extractString({ subject: 42 }, "subject")).toBeNull();
  });

  test("returns null when the value is null", () => {
    expect(extractString({ subject: null }, "subject")).toBeNull();
  });
});

describe("hook run", () => {
  const upsert = vi.fn();
  const success = { kind: "success", output: {} };

  beforeEach(() => {
    upsert.mockReset();
    vi.mocked(findGitRoot).mockReset().mockReturnValue("/repo");
    dbOpen.mockReset().mockReturnValue({ table: () => ({ upsert }), [Symbol.dispose]: vi.fn() });
  });

  const run = (input: Record<string, unknown>) =>
    captured.hook?.run(hookContext({ session_id: "s1", cwd: "/repo", ...input }));

  test("ignores tools it does not track", () => {
    expect(run({ tool_name: "Bash", tool_input: {} })).toEqual(success);
    expect(upsert).not.toHaveBeenCalled();
  });

  test("skips outside a git repository", () => {
    vi.mocked(findGitRoot).mockReturnValue(null);
    expect(run({ tool_name: "TaskCreate", tool_input: { subject: "a" } })).toEqual(success);
    expect(upsert).not.toHaveBeenCalled();
  });

  test("records a TaskCreate event", () => {
    expect(
      run({ tool_name: "TaskCreate", tool_input: { subject: "write", status: "pending" } }),
    ).toEqual(success);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "task_create",
        subject: "write",
        status: "pending",
        session_id: "s1",
        project_path: "/repo",
        raw_response: "",
      }),
    );
  });

  test("falls back to content for the subject and labels TaskUpdate", () => {
    run({ tool_name: "TaskUpdate", tool_input: { content: "c", status: "completed" } });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: "task_update", subject: "c" }),
    );
  });

  test("records the todos that changed in a TodoWrite", () => {
    run({
      tool_name: "TodoWrite",
      tool_input: {},
      tool_response: {
        oldTodos: [todo("a", "pending")],
        newTodos: [todo("a", "completed"), todo("b", "pending")],
      },
    });
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: "todo_complete", subject: "a" }),
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: "todo_create", subject: "b" }),
    );
  });

  test("records nothing for a TodoWrite without changes or malformed todos", () => {
    run({ tool_name: "TodoWrite", tool_input: {}, tool_response: { newTodos: "bad" } });
    run({ tool_name: "TodoWrite", tool_input: {} });
    expect(upsert).not.toHaveBeenCalled();
  });

  test("does not fail the tool call when persisting throws", () => {
    upsert.mockImplementation(() => {
      throw new Error("db locked");
    });
    expect(run({ tool_name: "TaskCreate", tool_input: { subject: "a" } })).toEqual(success);
  });
});
