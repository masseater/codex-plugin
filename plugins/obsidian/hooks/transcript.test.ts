import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { expandHome } from "./lib/home-path.ts";
import { countAssistantMessages, MIN_ASSISTANT_MESSAGES } from "./lib/transcript.ts";

const tmpDirs: string[] = [];

function createTmpDir(): string {
  const dir = path.join(
    process.env.TMPDIR ?? "/tmp",
    `obsidian-transcript-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  tmpDirs.push(dir);
  return dir;
}

function writeJsonl(filePath: string, lines: string[]): void {
  writeFileSync(filePath, `${lines.join("\n")}\n`);
}

afterEach(() => {
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

describe("MIN_ASSISTANT_MESSAGES", () => {
  test("is a positive number", () => {
    expect(MIN_ASSISTANT_MESSAGES).toBeGreaterThan(0);
  });
});

describe("countAssistantMessages", () => {
  test("counts assistant messages and ignores user messages", () => {
    const dir = createTmpDir();
    const transcriptPath = path.join(dir, "transcript.jsonl");
    writeJsonl(transcriptPath, [
      JSON.stringify({ type: "user", message: { role: "user", content: [{ text: "hi" }] } }),
      JSON.stringify({
        type: "assistant",
        message: { role: "assistant", content: [{ text: "hello" }] },
      }),
      JSON.stringify({
        type: "assistant",
        message: { role: "assistant", content: [{ text: "world" }] },
      }),
    ]);

    expect(countAssistantMessages(transcriptPath)).toBe(2);
  });

  test("skips malformed JSON lines", () => {
    const dir = createTmpDir();
    const transcriptPath = path.join(dir, "transcript.jsonl");
    writeJsonl(transcriptPath, [
      "{not valid json",
      JSON.stringify({
        type: "assistant",
        message: { role: "assistant", content: [{ text: "hello" }] },
      }),
    ]);

    expect(countAssistantMessages(transcriptPath)).toBe(1);
  });

  test("skips assistant messages with empty text", () => {
    const dir = createTmpDir();
    const transcriptPath = path.join(dir, "transcript.jsonl");
    writeJsonl(transcriptPath, [
      JSON.stringify({
        type: "assistant",
        message: { role: "assistant", content: [{ text: "" }] },
      }),
      JSON.stringify({
        type: "assistant",
        message: { role: "assistant", content: [{ text: "   " }] },
      }),
      JSON.stringify({
        type: "assistant",
        message: { role: "assistant", content: [{ text: "not empty" }] },
      }),
    ]);

    expect(countAssistantMessages(transcriptPath)).toBe(1);
  });

  test("counts entries identified by message.role even without a matching type field", () => {
    const dir = createTmpDir();
    const transcriptPath = path.join(dir, "transcript.jsonl");
    writeJsonl(transcriptPath, [
      JSON.stringify({ message: { role: "assistant", content: [{ text: "hello" }] } }),
    ]);

    expect(countAssistantMessages(transcriptPath)).toBe(1);
  });

  test("returns 0 for an empty file", () => {
    const dir = createTmpDir();
    const transcriptPath = path.join(dir, "transcript.jsonl");
    writeFileSync(transcriptPath, "");

    expect(countAssistantMessages(transcriptPath)).toBe(0);
  });
});

describe("expandHome", () => {
  test("expands a ~/ prefix to the home directory", () => {
    const result = expandHome("~/transcripts/session.jsonl");
    expect(result).toBe(path.resolve(path.join(homedir(), "transcripts/session.jsonl")));
  });

  test("resolves relative paths without a ~/ prefix as-is", () => {
    const result = expandHome("./transcripts/session.jsonl");
    expect(result).toBe(path.resolve("./transcripts/session.jsonl"));
  });

  test("leaves absolute paths unchanged", () => {
    const result = expandHome("/absolute/path/session.jsonl");
    expect(result).toBe(path.resolve("/absolute/path/session.jsonl"));
  });
});
