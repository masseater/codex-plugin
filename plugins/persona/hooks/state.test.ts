import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test as base, describe, expect } from "vite-plus/test";
import {
  clearPersona,
  type Persona,
  isPersona,
  markInjected,
  personaPrompt,
  readInjectedPersona,
  readPersona,
  resolveStateFile,
  writePersona,
} from "./lib/state.ts";

// 登録されている全 persona（state.ts の定義と同じ順）
const PERSONAS: readonly Persona[] = [
  "planner",
  "worker",
  "idealist",
  "orchestrator",
  "sparring",
  "pathfinder",
];

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
  test("accepts idealist", () => {
    expect(isPersona("idealist")).toBe(true);
  });
  test("accepts orchestrator", () => {
    expect(isPersona("orchestrator")).toBe(true);
  });
  test("accepts sparring", () => {
    expect(isPersona("sparring")).toBe(true);
  });
  test("accepts pathfinder", () => {
    expect(isPersona("pathfinder")).toBe(true);
  });
  test("rejects removed foreman persona", () => {
    expect(isPersona("foreman")).toBe(false);
  });
  test("rejects unknown value", () => {
    expect(isPersona("foo")).toBe(false);
    expect(isPersona("")).toBe(false);
    expect(isPersona("PLANNER")).toBe(false);
  });
});

describe("persona registry", () => {
  test("accepts every persona", () => {
    for (const persona of PERSONAS) {
      expect(isPersona(persona)).toBe(true);
    }
  });
});

describe("resolveStateFile", () => {
  test("builds path under project's .local-agents/tmp/persona", () => {
    expect(resolveStateFile("/proj", "abc-123")).toBe("/proj/.local-agents/tmp/persona/abc-123");
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

  test("returns 'idealist' when file content is idealist", ({ tempDir }) => {
    const stateFile = resolveStateFile(tempDir, "s2-idealist");
    writePersona(stateFile, "idealist");
    expect(readPersona(stateFile)).toBe("idealist");
  });

  test("returns 'orchestrator' when file content is orchestrator", ({ tempDir }) => {
    const stateFile = resolveStateFile(tempDir, "s2-orchestrator");
    writePersona(stateFile, "orchestrator");
    expect(readPersona(stateFile)).toBe("orchestrator");
  });

  test("returns 'sparring' when file content is sparring", ({ tempDir }) => {
    const stateFile = resolveStateFile(tempDir, "s2-sparring");
    writePersona(stateFile, "sparring");
    expect(readPersona(stateFile)).toBe("sparring");
  });

  test("returns 'pathfinder' when file content is pathfinder", ({ tempDir }) => {
    const stateFile = resolveStateFile(tempDir, "s2-pathfinder");
    writePersona(stateFile, "pathfinder");
    expect(readPersona(stateFile)).toBe("pathfinder");
  });

  test("returns undefined for invalid content", ({ tempDir }) => {
    const stateFile = resolveStateFile(tempDir, "s3");
    mkdirSync(join(tempDir, ".local-agents/tmp/persona"), { recursive: true });
    writeFileSync(stateFile, "garbage\n");
    expect(readPersona(stateFile)).toBeUndefined();
  });

  test("trims surrounding whitespace", ({ tempDir }) => {
    const stateFile = resolveStateFile(tempDir, "s4");
    mkdirSync(join(tempDir, ".local-agents/tmp/persona"), { recursive: true });
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
  test("removes existing state and injected marker", ({ tempDir }) => {
    const stateFile = resolveStateFile(tempDir, "to-clear");
    writePersona(stateFile, "planner");
    markInjected(stateFile, "planner");
    clearPersona(stateFile);
    expect(existsSync(stateFile)).toBe(false);
    expect(readInjectedPersona(stateFile)).toBeUndefined();
  });

  test("no-op when file does not exist", ({ tempDir }) => {
    const stateFile = resolveStateFile(tempDir, "never-was");
    expect(() => clearPersona(stateFile)).not.toThrow();
  });
});

describe("injected marker", () => {
  test("is undefined before any injection", ({ tempDir }) => {
    const stateFile = resolveStateFile(tempDir, "fresh");
    writePersona(stateFile, "planner");
    expect(readInjectedPersona(stateFile)).toBeUndefined();
  });

  test("records the last injected persona separately from the state file", ({ tempDir }) => {
    const stateFile = resolveStateFile(tempDir, "marked");
    writePersona(stateFile, "planner");
    markInjected(stateFile, "planner");
    expect(readInjectedPersona(stateFile)).toBe("planner");
    expect(readFileSync(stateFile, "utf-8")).toBe("planner\n");
  });
});

// persona ごとの詳細ガイド（plugin の personas/ 配下）
function personaGuide(persona: Persona): string {
  return join(import.meta.dirname, "..", "personas", `${persona}.md`);
}

describe("personaPrompt", () => {
  for (const persona of PERSONAS) {
    test(`starts with the ${persona} prompt and points to its guide`, () => {
      const result = personaPrompt(persona);
      expect(result.startsWith(`[Persona: ${persona}]`)).toBe(true);
      expect(result).toContain(personaGuide(persona));
      expect(result).toContain("この persona の方針を優先する");
    });

    test(`${persona} guide file exists`, () => {
      expect(existsSync(personaGuide(persona))).toBe(true);
    });
  }

  test("does not reference persona skills that Claude cannot invoke", () => {
    for (const persona of PERSONAS) {
      expect(personaPrompt(persona)).not.toContain("Skill ツール");
    }
  });
});
