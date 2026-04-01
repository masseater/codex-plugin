import { afterEach, describe, expect, it, vi } from "vitest";
import { readDiscordEnv } from "./env.ts";

describe("readDiscordEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when DISCORD_NOTIFY_CHANNEL_ID is not set", () => {
    vi.stubEnv("DISCORD_NOTIFY_CHANNEL_ID", "");
    expect(readDiscordEnv()).toBeNull();
  });

  it("returns null when DISCORD_NOTIFY_CHANNEL_ID is undefined", () => {
    delete process.env.DISCORD_NOTIFY_CHANNEL_ID;
    expect(readDiscordEnv()).toBeNull();
  });

  it("returns config when both env vars are set", () => {
    vi.stubEnv("DISCORD_NOTIFY_CHANNEL_ID", "123456");
    vi.stubEnv("DISCORD_BOT_TOKEN", "bot-token-xxx");

    expect(readDiscordEnv()).toEqual({
      channelId: "123456",
      botToken: "bot-token-xxx",
    });
  });

  it("throws when CHANNEL_ID is set but BOT_TOKEN is missing", () => {
    vi.stubEnv("DISCORD_NOTIFY_CHANNEL_ID", "123456");
    vi.stubEnv("DISCORD_BOT_TOKEN", "");

    expect(() => readDiscordEnv()).toThrow(
      "DISCORD_NOTIFY_CHANNEL_ID is set but DISCORD_BOT_TOKEN is missing",
    );
  });
});
