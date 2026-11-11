import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { runScript } from "../../__tests__/run-script.ts";
import type { TaskEvent } from "../../hooks/lib/task-events-schema.ts";

// MutilsDB は bun:sqlite に依存するため vitest では開けない。偽物の DB に差し替える
const lib = vi.hoisted(() => ({
  findGitRoot: vi.fn(),
  findAll: vi.fn(),
  all: vi.fn(),
}));

vi.mock("@r_masseater/cc-plugin-lib", () => ({
  HookLogger: { fromFile: () => ({ debug: vi.fn() }) },
  findGitRoot: lib.findGitRoot,
  MutilsDB: {
    open: () => ({
      table: () => ({ findAll: lib.findAll }),
      all: lib.all,
      [Symbol.dispose]: () => {},
    }),
  },
}));

const SCRIPT = `${import.meta.dirname}/query.ts`;

function event(overrides: Partial<TaskEvent>): TaskEvent {
  return {
    id: 1,
    event_type: "task_create",
    tool_name: "TaskCreate",
    subject: "write tests",
    status: "pending",
    session_id: "session-aaaaaaaaaaaa-xyz",
    project_path: "/p",
    raw_input: JSON.stringify({ subject: "write tests" }),
    raw_response: JSON.stringify({ id: "1" }),
    created_at: "2026-01-02T03:04:05.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  lib.findGitRoot.mockReset().mockReturnValue("/repo");
  lib.findAll.mockReset().mockReturnValue([]);
  lib.all.mockReset().mockReturnValue([]);
});

describe("query.ts", () => {
  test("fails outside a git repository", async () => {
    lib.findGitRoot.mockReturnValue(null);
    const result = await runScript(SCRIPT);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Not in a git repository");
  });

  test("says so when there are no events", async () => {
    const result = await runScript(SCRIPT);
    expect(result).toMatchObject({ exitCode: 0, stdout: "No task events found.\n" });
    expect(lib.findAll).toHaveBeenCalledWith("1=1 ORDER BY created_at DESC LIMIT ?", [50]);
  });

  test("prints events grouped by session in chronological order", async () => {
    lib.findAll.mockReturnValue([
      event({
        id: 2,
        event_type: "task_update",
        status: "completed",
        created_at: "2026-01-02T03:05:00Z",
      }),
      event({ id: 1 }),
      event({ id: 3, session_id: "other", subject: null, status: null, event_type: "todo_create" }),
    ]);
    const result = await runScript(SCRIPT);
    expect(result.stdout).toContain("# Task History (3 events)");
    expect(result.stdout).toContain("## Session session-aaaa... (2026-01-02)");
    expect(result.stdout).toContain("- [ ] `03:04:05` **task create**: write tests");
    expect(result.stdout).toContain("- [x] `03:05:00` **task update**: write tests");
    expect(result.stdout).toContain("- [-] `03:04:05` **todo create**: (no subject)");
    expect(result.stdout.indexOf("task create")).toBeLessThan(result.stdout.indexOf("task update"));
  });

  test("shows in-progress events with their own icon", async () => {
    lib.findAll.mockReturnValue([event({ status: "in_progress" })]);
    expect((await runScript(SCRIPT)).stdout).toContain("- [~]");
  });

  test("builds the query from --session, --status, --since and --recent", async () => {
    await runScript(SCRIPT, [
      "--session",
      "s1",
      "--status",
      "pending",
      "--since",
      "2026-01-01",
      "--recent",
      "5",
    ]);
    expect(lib.findAll).toHaveBeenCalledWith(
      "session_id = ? AND status = ? AND created_at >= ? ORDER BY created_at DESC LIMIT ?",
      ["s1", "pending", "2026-01-01", 5],
    );
  });

  describe("--open", () => {
    const openEvents = [
      event({ id: 1 }),
      event({
        id: 2,
        tool_name: "TaskUpdate",
        raw_input: JSON.stringify({ taskId: "1", status: "in_progress" }),
      }),
    ];

    test("lists open tasks of the most recent sessions", async () => {
      lib.all.mockReturnValue([{ session_id: "s1" }, { session_id: 5 }, { session_id: "s2" }]);
      lib.findAll.mockImplementation((_where: string, params: string[]) =>
        params[0] === "s1" ? openEvents : [],
      );
      const result = await runScript(SCRIPT, ["--open", "--recent", "3"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("## Session s1 (last update 2026-01-02T03:04)");
      expect(result.stdout).toContain("- [in_progress] write tests");
      expect(result.stdout).not.toContain("s2");
      expect(lib.all.mock.calls[0]?.[1]).toEqual([3]);
    });

    test("restricts to --session without scanning recent sessions", async () => {
      lib.findAll.mockReturnValue(openEvents);
      const result = await runScript(SCRIPT, ["--open", "--session", "only"]);
      expect(result.stdout).toContain("## Session only");
      expect(lib.all).not.toHaveBeenCalled();
    });

    test("says so when nothing is open", async () => {
      const result = await runScript(SCRIPT, ["--open"]);
      expect(result.stdout).toBe("No open tasks found.\n");
    });
  });
});
