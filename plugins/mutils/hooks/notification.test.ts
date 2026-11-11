import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";

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
}));
vi.mock("cc-hooks-ts", () => ({
  defineHook: vi.fn((opts: { run: (ctx: unknown) => unknown }) => opts),
  runHook: vi.fn(),
}));

import { extractLastAssistantMessage, resolveTranscriptPath } from "./lib/transcript.ts";

function createTmpDir(): string {
  const dir = path.join(
    tmpdir(),
    `send-notification-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

const tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

describe("resolveTranscriptPath", () => {
  test("expands leading '~/' to the home directory", () => {
    const result = resolveTranscriptPath("~/.claude/projects/foo/transcript.jsonl");
    expect(result).toBe(path.resolve(homedir(), ".claude/projects/foo/transcript.jsonl"));
  });

  test("resolves a relative path against cwd", () => {
    const result = resolveTranscriptPath("some/relative/transcript.jsonl");
    expect(result).toBe(path.resolve("some/relative/transcript.jsonl"));
  });

  test("leaves an already-absolute path unchanged (aside from normalization)", () => {
    const result = resolveTranscriptPath("/tmp/foo/transcript.jsonl");
    expect(result).toBe(path.resolve("/tmp/foo/transcript.jsonl"));
  });
});

describe("extractLastAssistantMessage", () => {
  test("returns the text content of the last line's message", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);
    const filePath = path.join(dir, "transcript.jsonl");
    writeFileSync(
      filePath,
      [
        JSON.stringify({ message: { content: [{ text: "first" }] } }),
        JSON.stringify({ message: { content: [{ text: "last message" }] } }),
      ].join("\n"),
    );

    expect(extractLastAssistantMessage(filePath)).toBe("last message");
  });

  test("ignores trailing blank lines", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);
    const filePath = path.join(dir, "transcript.jsonl");
    writeFileSync(
      filePath,
      [JSON.stringify({ message: { content: [{ text: "content" }] } }), "", ""].join("\n"),
    );

    expect(extractLastAssistantMessage(filePath)).toBe("content");
  });

  test("returns undefined when the file is empty", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);
    const filePath = path.join(dir, "transcript.jsonl");
    writeFileSync(filePath, "");

    expect(extractLastAssistantMessage(filePath)).toBeUndefined();
  });

  test("returns undefined when the last line has no message content", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);
    const filePath = path.join(dir, "transcript.jsonl");
    writeFileSync(filePath, JSON.stringify({ type: "system" }));

    expect(extractLastAssistantMessage(filePath)).toBeUndefined();
  });

  test("skips thinking blocks and returns the text block", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);
    const filePath = path.join(dir, "transcript.jsonl");
    writeFileSync(
      filePath,
      JSON.stringify({
        message: {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "..." },
            { type: "text", text: "final answer" },
          ],
        },
      }),
    );

    expect(extractLastAssistantMessage(filePath)).toBe("final answer");
  });

  test("walks back past trailing non-assistant and unparsable lines", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);
    const filePath = path.join(dir, "transcript.jsonl");
    writeFileSync(
      filePath,
      [
        JSON.stringify({
          message: { role: "assistant", content: [{ type: "text", text: "reply" }] },
        }),
        JSON.stringify({ message: { role: "user", content: [{ type: "tool_result" }] } }),
        JSON.stringify({ type: "system" }),
        '{"partial":',
      ].join("\n"),
    );

    expect(extractLastAssistantMessage(filePath)).toBe("reply");
  });

  test("reads plain string content and skips blank strings", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);
    const filePath = path.join(dir, "transcript.jsonl");
    writeFileSync(
      filePath,
      [
        JSON.stringify({ message: { content: "plain reply" } }),
        JSON.stringify({ message: { content: "   " } }),
        JSON.stringify({ message: { content: 42 } }),
      ].join("\n"),
    );

    expect(extractLastAssistantMessage(filePath)).toBe("plain reply");
  });

  test("joins several text blocks and drops empty ones", () => {
    const dir = createTmpDir();
    tmpDirs.push(dir);
    const filePath = path.join(dir, "transcript.jsonl");
    writeFileSync(
      filePath,
      JSON.stringify({
        message: {
          content: [{ text: "a" }, { type: "text", text: "" }, { type: "text", text: "b" }],
        },
      }),
    );

    expect(extractLastAssistantMessage(filePath)).toBe("a\nb");
  });
});
