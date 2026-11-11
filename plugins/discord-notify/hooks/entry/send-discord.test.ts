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
  splitMessage: vi.fn(),
}));

vi.mock("../lib/db.ts", () => ({
  openDb: vi.fn(),
  ensureTable: vi.fn(),
  getThreadId: vi.fn(),
}));

import { getThreadId, openDb } from "../lib/db.ts";
import { sendMessage, splitMessage } from "../lib/discord-api.ts";
import { readDiscordEnv } from "../lib/env.ts";
import { hook } from "./send-discord.ts";

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    input: {
      cwd: "/home/user/my-project",
      session_id: "sess-abc",
      hook_event_name: "Stop" as const,
      transcript_path: "/tmp/transcript",
      stop_hook_active: false,
      last_assistant_message: "Hello, I finished the task.",
      ...overrides,
    },
    success: vi.fn().mockReturnValue({ exit: 0 }),
    json: vi.fn(),
    blockingError: vi.fn(),
    nonBlockingError: vi.fn(),
    defer: vi.fn(),
  };
}

describe("send-discord hook", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips when stop_hook_active is true", async () => {
    const ctx = makeContext({ stop_hook_active: true });

    await hook.run(ctx as never);

    expect(ctx.success).toHaveBeenCalledWith({});
    expect(readDiscordEnv).not.toHaveBeenCalled();
  });

  it("skips when env returns null", async () => {
    vi.mocked(readDiscordEnv).mockReturnValue(null);
    const ctx = makeContext();

    await hook.run(ctx as never);

    expect(ctx.success).toHaveBeenCalledWith({});
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("skips when last_assistant_message is empty", async () => {
    vi.mocked(readDiscordEnv).mockReturnValue({
      channelId: "ch-1",
      botToken: "tok",
    });
    const ctx = makeContext({ last_assistant_message: undefined });

    await hook.run(ctx as never);

    expect(ctx.success).toHaveBeenCalledWith({});
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("skips when no thread found in db", async () => {
    vi.mocked(readDiscordEnv).mockReturnValue({
      channelId: "ch-1",
      botToken: "tok",
    });
    const mockDb = { close: vi.fn() };
    vi.mocked(openDb).mockReturnValue(mockDb as never);
    vi.mocked(getThreadId).mockReturnValue(null);

    const ctx = makeContext();
    await hook.run(ctx as never);

    expect(ctx.success).toHaveBeenCalledWith({});
    expect(sendMessage).not.toHaveBeenCalled();
    expect(mockDb.close).toHaveBeenCalled();
  });

  it("splits and sends message to thread", async () => {
    vi.mocked(readDiscordEnv).mockReturnValue({
      channelId: "ch-1",
      botToken: "tok",
    });
    const mockDb = { close: vi.fn() };
    vi.mocked(openDb).mockReturnValue(mockDb as never);
    vi.mocked(getThreadId).mockReturnValue("thread-1");
    vi.mocked(splitMessage).mockReturnValue(["chunk1", "chunk2"]);
    vi.mocked(sendMessage).mockResolvedValue({ id: "msg-1" });

    const ctx = makeContext();
    await hook.run(ctx as never);

    expect(splitMessage).toHaveBeenCalledWith("Hello, I finished the task.");
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenNthCalledWith(1, "thread-1", "tok", "chunk1");
    expect(sendMessage).toHaveBeenNthCalledWith(2, "thread-1", "tok", "chunk2");
    expect(ctx.success).toHaveBeenCalledWith({});
  });

  it("catches Discord API errors and returns success", async () => {
    vi.mocked(readDiscordEnv).mockReturnValue({
      channelId: "ch-1",
      botToken: "tok",
    });
    const mockDb = { close: vi.fn() };
    vi.mocked(openDb).mockReturnValue(mockDb as never);
    vi.mocked(getThreadId).mockReturnValue("thread-1");
    vi.mocked(splitMessage).mockReturnValue(["chunk1"]);
    vi.mocked(sendMessage).mockRejectedValue(new Error("Discord error"));

    const ctx = makeContext();
    await hook.run(ctx as never);

    expect(ctx.success).toHaveBeenCalledWith({});
  });
});
