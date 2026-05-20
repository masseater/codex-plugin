import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test as base, describe, expect } from "vitest";
import {
  clearPersona,
  isPersona,
  personaPrompt,
  PLANNER_PROMPT,
  readPersona,
  resolveStateFile,
  WORKER_PROMPT,
  writePersona,
} from "./lib/state.ts";

const test = base.extend<{ tempDir: string }>({
  tempDir: async ({ task: _task }, use) => {
    const dir = join(tmpdir(), `persona-state-test-${Date.now()}-${Math.random()}`);
    mkdirSync(dir, { recursive: true });
    await use(dir);
    rmSync(dir, { recursive: true, force: true });
  },
});

describe("isPersona", () => {
  test("accepts planner", () => {
    expect(isPersona("planner")).toBe(true);
  });
  test("accepts worker", () => {
    expect(isPersona("worker")).toBe(true);
  });
  test("rejects unknown value", () => {
    expect(isPersona("foo")).toBe(false);
    expect(isPersona("")).toBe(false);
    expect(isPersona("PLANNER")).toBe(false);
  });
});

describe("resolveStateFile", () => {
  test("builds path under project's .agents/tmp/persona", () => {
    expect(resolveStateFile("/proj", "abc-123")).toBe("/proj/.agents/tmp/persona/abc-123");
  });
});

describe("readPersona", () => {
  test("returns undefined when file does not exist", ({ tempDir }) => {
    const stateFile = resolveStateFile(tempDir, "missing");
    expect(readPersona(stateFile)).toBeUndefined();
  });

  test("returns 'planner' when file content is planner", ({ tempDir }) => {
    const stateFile = resolveStateFile(tempDir, "s1");
    writePersona(stateFile, "planner");
    expect(readPersona(stateFile)).toBe("planner");
  });

  test("returns 'worker' when file content is worker", ({ tempDir }) => {
    const stateFile = resolveStateFile(tempDir, "s2");
    writePersona(stateFile, "worker");
    expect(readPersona(stateFile)).toBe("worker");
  });

  test("returns undefined for invalid content", ({ tempDir }) => {
    const stateFile = resolveStateFile(tempDir, "s3");
    mkdirSync(join(tempDir, ".agents/tmp/persona"), { recursive: true });
    writeFileSync(stateFile, "garbage\n");
    expect(readPersona(stateFile)).toBeUndefined();
  });

  test("trims surrounding whitespace", ({ tempDir }) => {
    const stateFile = resolveStateFile(tempDir, "s4");
    mkdirSync(join(tempDir, ".agents/tmp/persona"), { recursive: true });
    writeFileSync(stateFile, "  planner  \n");
    expect(readPersona(stateFile)).toBe("planner");
  });
});

describe("writePersona", () => {
  test("creates parent directories as needed", ({ tempDir }) => {
    const stateFile = resolveStateFile(tempDir, "deeply-nested");
    writePersona(stateFile, "worker");
    expect(existsSync(stateFile)).toBe(true);
    expect(readPersona(stateFile)).toBe("worker");
  });

  test("overwrites existing state", ({ tempDir }) => {
    const stateFile = resolveStateFile(tempDir, "overwrite");
    writePersona(stateFile, "planner");
    writePersona(stateFile, "worker");
    expect(readPersona(stateFile)).toBe("worker");
  });
});

describe("clearPersona", () => {
  test("removes existing file", ({ tempDir }) => {
    const stateFile = resolveStateFile(tempDir, "to-clear");
    writePersona(stateFile, "planner");
    clearPersona(stateFile);
    expect(existsSync(stateFile)).toBe(false);
  });

  test("no-op when file does not exist", ({ tempDir }) => {
    const stateFile = resolveStateFile(tempDir, "never-was");
    expect(() => clearPersona(stateFile)).not.toThrow();
  });
});

describe("personaPrompt", () => {
  test("returns planner prompt for planner", () => {
    expect(personaPrompt("planner")).toBe(PLANNER_PROMPT);
    expect(PLANNER_PROMPT).toContain("[Persona: planner]");
  });

  test("returns worker prompt for worker", () => {
    expect(personaPrompt("worker")).toBe(WORKER_PROMPT);
    expect(WORKER_PROMPT).toContain("[Persona: worker]");
  });
});
