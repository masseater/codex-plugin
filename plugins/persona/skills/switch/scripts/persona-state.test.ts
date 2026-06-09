import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test as base } from "vitest";
import { runPersonaState, type PersonaStateEnv } from "./persona-state.ts";

const test = base.extend<{ tempDir: string }>({
  tempDir: async ({ task: _task }, use) => {
    const dir = join(tmpdir(), `persona-skill-state-test-${Date.now()}-${Math.random()}`);
    mkdirSync(dir, { recursive: true });
    await use(dir);
    rmSync(dir, { recursive: true, force: true });
  },
});

function env(tempDir: string): PersonaStateEnv {
  return {
    projectDir: tempDir,
    sessionId: "session-1",
  };
}

describe("runPersonaState", () => {
  test("writes planner state", ({ tempDir }) => {
    const result = runPersonaState("planner", env(tempDir));

    expect(result).toEqual({
      action: "planner",
      persona: "planner",
      stateFile: join(tempDir, ".agents/tmp/persona/session-1"),
    });
    expect(readFileSync(result.stateFile, "utf-8")).toBe("planner\n");
  });

  test("writes worker state", ({ tempDir }) => {
    const result = runPersonaState("worker", env(tempDir));

    expect(result.persona).toBe("worker");
    expect(readFileSync(result.stateFile, "utf-8")).toBe("worker\n");
  });

  test("returns null status when state file does not exist", ({ tempDir }) => {
    const result = runPersonaState("status", env(tempDir));

    expect(result.action).toBe("status");
    expect(result.persona).toBeNull();
  });

  test("reads existing status", ({ tempDir }) => {
    const stateFile = join(tempDir, ".agents/tmp/persona/session-1");
    mkdirSync(join(tempDir, ".agents/tmp/persona"), { recursive: true });
    writeFileSync(stateFile, "worker\n");

    expect(runPersonaState("status", env(tempDir))).toEqual({
      action: "status",
      persona: "worker",
      stateFile,
    });
  });

  test("returns null for invalid existing status", ({ tempDir }) => {
    const stateFile = join(tempDir, ".agents/tmp/persona/session-1");
    mkdirSync(join(tempDir, ".agents/tmp/persona"), { recursive: true });
    writeFileSync(stateFile, "unknown\n");

    expect(runPersonaState("status", env(tempDir)).persona).toBeNull();
  });

  test("clears state file", ({ tempDir }) => {
    const written = runPersonaState("planner", env(tempDir));

    const result = runPersonaState("clear", env(tempDir));

    expect(result.persona).toBeNull();
    expect(existsSync(written.stateFile)).toBe(false);
  });

  test("requires project dir and session id", () => {
    expect(() => runPersonaState("status", {})).toThrow(
      "CLAUDE_PROJECT_DIR and CLAUDE_CODE_SESSION_ID are required",
    );
  });

  test("rejects unknown action", ({ tempDir }) => {
    expect(() => runPersonaState("bad-action", env(tempDir))).toThrow("Unknown action: bad-action");
  });
});
