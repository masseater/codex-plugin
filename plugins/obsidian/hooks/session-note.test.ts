import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

// cc-plugin-lib と cc-hooks-ts をモックする。
// 実際の cc-plugin-lib バレルは MutilsDB 経由で bun:sqlite を import しており、
// vitest の Node/Vite ランタイムでは読み込めないため
// （ccs-symlink-check.test.ts と同じ規約）。
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
// defineHook に渡された run 関数を捕捉し、トップレベルの wrapRun 本体を
// 直接呼び出してテストできるようにする（ccs-symlink-check.test.ts と同じ規約）。
const { capturedHookDefs } = vi.hoisted(() => {
  const defs: { run: (ctx: unknown) => unknown }[] = [];
  return { capturedHookDefs: defs };
});
vi.mock("cc-hooks-ts", () => ({
  defineHook: vi.fn((opts: { run: (ctx: unknown) => unknown }) => {
    capturedHookDefs.push(opts);
    return opts;
  }),
  runHook: vi.fn(),
}));

import { SESSION_NOTE_MESSAGE } from "./entry/session-note.ts";
import { getSessionState, updateSessionState } from "./lib/session-state.ts";
import { MIN_ASSISTANT_MESSAGES } from "./lib/transcript.ts";

// session-state.ts は XDG_STATE_HOME 配下に実ファイルを書くため、
// 実ユーザーの ~/.local/state を汚さないよう一時ディレクトリに差し替える
// （session-state.test.ts と同じ規約）。
let originalXdgStateHome: string | undefined;
const tmpDirs: string[] = [];

function createTmpDir(prefix: string): string {
  const dir = path.join(
    process.env.TMPDIR ?? "/tmp",
    `obsidian-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  tmpDirs.push(dir);
  return dir;
}

beforeEach(() => {
  originalXdgStateHome = process.env.XDG_STATE_HOME;
  process.env.XDG_STATE_HOME = createTmpDir("session-note-state");
});

afterEach(() => {
  if (originalXdgStateHome === undefined) {
    delete process.env.XDG_STATE_HOME;
  } else {
    process.env.XDG_STATE_HOME = originalXdgStateHome;
  }
  for (const dir of tmpDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

function assistantMessage(text: string): string {
  return JSON.stringify({
    type: "assistant",
    message: { role: "assistant", content: [{ text }] },
  });
}

function writeTranscript(lines: string[]): string {
  const dir = createTmpDir("session-note-transcript");
  const transcriptPath = path.join(dir, "transcript.jsonl");
  writeFileSync(transcriptPath, `${lines.join("\n")}\n`);
  return transcriptPath;
}

function makeContext(input: Record<string, unknown>) {
  return {
    input,
    success: vi.fn().mockReturnValue({ type: "success" }),
    json: vi.fn().mockReturnValue({ type: "json" }),
  };
}

describe("session-note hook", () => {
  test("capturedHookDefs is populated after module import", () => {
    expect(capturedHookDefs.length).toBeGreaterThan(0);
  });

  test("returns success when stop_hook_active is already true", () => {
    const ctx = makeContext({
      stop_hook_active: true,
      session_id: "sess-stop-active",
      transcript_path: "irrelevant",
    });

    capturedHookDefs[0]!.run(ctx);

    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.json).not.toHaveBeenCalled();
  });

  test("returns success when the session has already been prompted", () => {
    const sessionId = "sess-already-prompted";
    updateSessionState(sessionId, { prompted: true });
    const ctx = makeContext({
      stop_hook_active: false,
      session_id: sessionId,
      transcript_path: "irrelevant",
    });

    capturedHookDefs[0]!.run(ctx);

    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.json).not.toHaveBeenCalled();
  });

  test("returns success and increments stopCount while below the stop-count threshold", () => {
    const sessionId = "sess-below-stop-threshold";
    const ctx = makeContext({
      stop_hook_active: false,
      session_id: sessionId,
      transcript_path: "irrelevant",
    });

    capturedHookDefs[0]!.run(ctx);

    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.json).not.toHaveBeenCalled();
    expect(getSessionState(sessionId).stopCount).toBe(1);
  });

  test("returns success when the stop-count threshold is met but transcript_path is missing", () => {
    const sessionId = "sess-no-transcript";
    updateSessionState(sessionId, { stopCount: 2 });
    const ctx = makeContext({
      stop_hook_active: false,
      session_id: sessionId,
    });

    capturedHookDefs[0]!.run(ctx);

    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.json).not.toHaveBeenCalled();
    expect(getSessionState(sessionId).prompted).toBe(false);
  });

  test("returns success when the stop-count threshold is met but the transcript cannot be read", () => {
    const sessionId = "sess-bad-transcript";
    updateSessionState(sessionId, { stopCount: 2 });
    const ctx = makeContext({
      stop_hook_active: false,
      session_id: sessionId,
      transcript_path: "/nonexistent/path/transcript.jsonl",
    });

    capturedHookDefs[0]!.run(ctx);

    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.json).not.toHaveBeenCalled();
  });

  test("returns success when the stop-count threshold is met but assistant messages are below the minimum", () => {
    const sessionId = "sess-below-min-messages";
    updateSessionState(sessionId, { stopCount: 2 });
    const lines = Array.from({ length: MIN_ASSISTANT_MESSAGES - 1 }, (_, i) =>
      assistantMessage(`message ${i}`),
    );
    const transcriptPath = writeTranscript(lines);
    const ctx = makeContext({
      stop_hook_active: false,
      session_id: sessionId,
      transcript_path: transcriptPath,
    });

    capturedHookDefs[0]!.run(ctx);

    expect(ctx.success).toHaveBeenCalledWith({});
    expect(ctx.json).not.toHaveBeenCalled();
  });

  test("marks the session as prompted and continues via additionalContext when both thresholds are met", () => {
    const sessionId = "sess-both-thresholds-met";
    updateSessionState(sessionId, { stopCount: 2 });
    const lines = Array.from({ length: MIN_ASSISTANT_MESSAGES }, (_, i) =>
      assistantMessage(`message ${i}`),
    );
    const transcriptPath = writeTranscript(lines);
    const ctx = makeContext({
      stop_hook_active: false,
      session_id: sessionId,
      transcript_path: transcriptPath,
    });

    capturedHookDefs[0]!.run(ctx);

    expect(ctx.success).not.toHaveBeenCalled();
    expect(ctx.json).toHaveBeenCalledTimes(1);
    expect(getSessionState(sessionId).prompted).toBe(true);
    const call: unknown = ctx.json.mock.calls[0]?.[0];
    expect(call).toMatchObject({
      event: "Stop",
      output: {
        hookSpecificOutput: { hookEventName: "Stop", additionalContext: SESSION_NOTE_MESSAGE },
      },
    });
    expect(call).not.toHaveProperty("output.decision");
    expect(SESSION_NOTE_MESSAGE).toContain("vault-maintainer");
  });

  test("continues at most once per session", () => {
    const sessionId = "sess-cap-once";
    updateSessionState(sessionId, { stopCount: 2 });
    const lines = Array.from({ length: MIN_ASSISTANT_MESSAGES }, (_, i) =>
      assistantMessage(`message ${i}`),
    );
    const transcriptPath = writeTranscript(lines);

    const first = makeContext({
      stop_hook_active: false,
      session_id: sessionId,
      transcript_path: transcriptPath,
    });
    capturedHookDefs[0]!.run(first);
    expect(first.json).toHaveBeenCalledTimes(1);

    const second = makeContext({
      stop_hook_active: false,
      session_id: sessionId,
      transcript_path: transcriptPath,
    });
    capturedHookDefs[0]!.run(second);
    expect(second.json).not.toHaveBeenCalled();
    expect(second.success).toHaveBeenCalledWith({});
  });
});
