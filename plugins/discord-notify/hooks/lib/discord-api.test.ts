import { afterEach, describe, expect, it, vi } from "vitest";
import { DISCORD_MAX_LENGTH, createThread, sendMessage, splitMessage } from "./discord-api.ts";

describe("splitMessage", () => {
  it("returns single-element array for short text", () => {
    expect(splitMessage("hello")).toEqual(["hello"]);
  });

  it("returns single-element array for empty string", () => {
    expect(splitMessage("")).toEqual([""]);
  });

  it("returns single-element array for exactly max length", () => {
    const text = "a".repeat(DISCORD_MAX_LENGTH);
    expect(splitMessage(text)).toEqual([text]);
  });

  it("splits at newline boundary when possible", () => {
    // 1500文字 + 改行 + 600文字 = 2101文字（2000超え）
    const firstPart = "a".repeat(1500);
    const secondPart = "b".repeat(600);
    const text = `${firstPart}\n${secondPart}`;

    const chunks = splitMessage(text);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe(`${firstPart}\n`);
    expect(chunks[1]).toBe(secondPart);
  });

  it("splits at max length when no suitable newline", () => {
    const text = "a".repeat(3000);
    const chunks = splitMessage(text);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toBe("a".repeat(DISCORD_MAX_LENGTH));
    expect(chunks[1]).toBe("a".repeat(1000));
  });

  it("never strips or truncates content", () => {
    const text = "x".repeat(5000);
    const chunks = splitMessage(text);
    const reassembled = chunks.join("");
    expect(reassembled).toBe(text);
  });

  it("preserves all content across multiple splits", () => {
    const lines = Array.from({ length: 100 }, (_, i) => `Line ${i}: ${"x".repeat(50)}`);
    const text = lines.join("\n");
    const chunks = splitMessage(text);
    const reassembled = chunks.join("");
    expect(reassembled).toBe(text);
  });
});

describe("sendMessage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends POST request to Discord API", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "msg-123" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await sendMessage("ch-1", "token", "hello");

    expect(result).toEqual({ id: "msg-123" });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://discord.com/api/v10/channels/ch-1/messages",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ content: "hello" }),
      }),
    );
  });

  it("throws on HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve("Forbidden"),
      }),
    );

    await expect(sendMessage("ch-1", "token", "hello")).rejects.toThrow(
      "Discord sendMessage failed (403): Forbidden",
    );
  });
});

describe("createThread", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates thread from message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "thread-456" }),
      }),
    );

    const result = await createThread("ch-1", "msg-1", "token", "My Thread");

    expect(result).toEqual({ id: "thread-456" });
    expect(fetch).toHaveBeenCalledWith(
      "https://discord.com/api/v10/channels/ch-1/messages/msg-1/threads",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "My Thread", auto_archive_duration: 1440 }),
      }),
    );
  });

  it("throws on HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve("Not Found"),
      }),
    );

    await expect(createThread("ch-1", "msg-1", "token", "name")).rejects.toThrow(
      "Discord createThread failed (404): Not Found",
    );
  });
});
