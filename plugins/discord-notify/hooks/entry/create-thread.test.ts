import { afterEach, describe, expect, it, vi } from "vitest";

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
  wrapRun: (_logger: unknown, fn: unknown) => fn,
}));

vi.mock("../lib/env.ts", () => ({
  readDiscordEnv: vi.fn(),
}));

vi.mock("../lib/discord-api.ts", () => ({
  sendMessage: vi.fn(),
  createThread: vi.fn(),
}));

vi.mock("../lib/db.ts", () => ({
  openDb: vi.fn(),
  ensureTable: vi.fn(),
  getThreadId: vi.fn(),
  saveSession: vi.fn(),
}));

import { getThreadId, openDb, saveSession } from "../lib/db.ts";
import { createThread, sendMessage } from "../lib/discord-api.ts";
import { readDiscordEnv } from "../lib/env.ts";
import { formatThreadName, hook } from "./create-thread.ts";

function makeContext() {
  return {
    input: {
      cwd: "/home/user/my-project",
      session_id: "sess-abc",
      hook_event_name: "SessionStart" as const,
      transcript_path: "/tmp/transcript",
    },
    success: vi.fn().mockReturnValue({ exit: 0 }),
    json: vi.fn(),
    blockingError: vi.fn(),
    nonBlockingError: vi.fn(),
    defer: vi.fn(),
  };
}

describe("formatThreadName", () => {
  it("includes project basename and date", () => {
    const name = formatThreadName("/home/user/my-project");
    expect(name).toMatch(/^my-project \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });
});

describe("create-thread hook", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips when env returns null", async () => {
    vi.mocked(readDiscordEnv).mockReturnValue(null);
    const ctx = makeContext();

    await hook.run(ctx as never);

    expect(ctx.success).toHaveBeenCalledWith({});
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("creates thread and saves to db on startup (no existing thread)", async () => {
    vi.mocked(readDiscordEnv).mockReturnValue({
      channelId: "ch-1",
      botToken: "tok",
    });
    vi.mocked(getThreadId).mockReturnValue(null);
    vi.mocked(sendMessage).mockResolvedValue({ id: "msg-1" });
    vi.mocked(createThread).mockResolvedValue({ id: "thread-1" });
    const mockDb = { close: vi.fn() };
    vi.mocked(openDb).mockReturnValue(mockDb as never);

    const ctx = makeContext();
    await hook.run(ctx as never);

    expect(sendMessage).toHaveBeenCalledWith(
      "ch-1",
      "tok",
      expect.stringContaining("Session started:"),
    );
    expect(createThread).toHaveBeenCalledWith("ch-1", "msg-1", "tok", expect.any(String));
    expect(saveSession).toHaveBeenCalledWith(mockDb, "sess-abc", "thread-1");
    expect(mockDb.close).toHaveBeenCalled();
    expect(ctx.success).toHaveBeenCalledWith({});
  });

  it("posts resume notice to existing thread on resume/clear/compact", async () => {
    vi.mocked(readDiscordEnv).mockReturnValue({
      channelId: "ch-1",
      botToken: "tok",
    });
    vi.mocked(getThreadId).mockReturnValue("existing-thread-id");
    vi.mocked(sendMessage).mockResolvedValue({ id: "msg-2" });
    const mockDb = { close: vi.fn() };
    vi.mocked(openDb).mockReturnValue(mockDb as never);

    const ctx = makeContext();
    await hook.run(ctx as never);

    expect(sendMessage).toHaveBeenCalledWith("existing-thread-id", "tok", "Session resumed");
    expect(createThread).not.toHaveBeenCalled();
    expect(saveSession).not.toHaveBeenCalled();
    expect(mockDb.close).toHaveBeenCalled();
    expect(ctx.success).toHaveBeenCalledWith({});
  });

  it("catches Discord API errors and returns success", async () => {
    vi.mocked(readDiscordEnv).mockReturnValue({
      channelId: "ch-1",
      botToken: "tok",
    });
    vi.mocked(getThreadId).mockReturnValue(null);
    vi.mocked(sendMessage).mockRejectedValue(new Error("Discord down"));
    const mockDb = { close: vi.fn() };
    vi.mocked(openDb).mockReturnValue(mockDb as never);

    const ctx = makeContext();
    await hook.run(ctx as never);

    expect(ctx.success).toHaveBeenCalledWith({});
  });
});
