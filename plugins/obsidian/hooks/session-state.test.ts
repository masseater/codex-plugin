import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { getSessionState, updateSessionState } from "./lib/session-state.ts";

// bun:test/vitest 共通で使う一時状態。実ユーザーの ~/.local/state を汚さないよう
// XDG_STATE_HOME を一時ディレクトリに差し替えてテストする。
const ctx: { tmpDir: string; originalXdgStateHome: string | undefined } = {
  tmpDir: "",
  originalXdgStateHome: undefined,
};

beforeEach(() => {
  ctx.originalXdgStateHome = process.env.XDG_STATE_HOME;
  ctx.tmpDir = path.join(
    tmpdir(),
    `obsidian-session-state-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(ctx.tmpDir, { recursive: true });
  process.env.XDG_STATE_HOME = ctx.tmpDir;
});

afterEach(() => {
  if (ctx.originalXdgStateHome === undefined) {
    delete process.env.XDG_STATE_HOME;
  } else {
    process.env.XDG_STATE_HOME = ctx.originalXdgStateHome;
  }
  rmSync(ctx.tmpDir, { recursive: true, force: true });
});

describe("getSessionState", () => {
  test("returns default state when no file exists", () => {
    const state = getSessionState("session-not-found");
    expect(state).toEqual({ stopCount: 0, prompted: false });
  });

  test("falls back to default state when the state file contains broken JSON", () => {
    const sessionId = "broken-session";
    const statePath = path.join(ctx.tmpDir, "claude-code-plugin", "obsidian", `${sessionId}.json`);
    mkdirSync(path.dirname(statePath), { recursive: true });
    writeFileSync(statePath, "{not valid json");

    const state = getSessionState(sessionId);
    expect(state).toEqual({ stopCount: 0, prompted: false });
  });
});

describe("updateSessionState", () => {
  test("persists a patch and returns it on subsequent reads", () => {
    const sessionId = "update-session";

    updateSessionState(sessionId, { stopCount: 1 });
    const state = getSessionState(sessionId);

    expect(state).toEqual({ stopCount: 1, prompted: false });
  });

  test("merges multiple updates instead of overwriting the whole state", () => {
    const sessionId = "merge-session";

    updateSessionState(sessionId, { stopCount: 1 });
    updateSessionState(sessionId, { prompted: true });
    const state = getSessionState(sessionId);

    expect(state).toEqual({ stopCount: 1, prompted: true });

    const statePath = path.join(ctx.tmpDir, "claude-code-plugin", "obsidian", `${sessionId}.json`);
    expect(existsSync(statePath)).toBe(true);
  });
});
