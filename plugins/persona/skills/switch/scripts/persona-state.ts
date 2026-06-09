#!/usr/bin/env bun
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

type Persona = "planner" | "worker";
export type PersonaStateAction = Persona | "clear" | "status";
export type PersonaStateEnv = {
  projectDir?: string | undefined;
  sessionId?: string | undefined;
};
export type PersonaStateResult = {
  action: PersonaStateAction;
  persona: Persona | null;
  stateFile: string;
};

export function runPersonaState(action: string, env: PersonaStateEnv): PersonaStateResult {
  const projectDir = env.projectDir;
  const sessionId = env.sessionId;

  if (!projectDir || !sessionId) {
    throw new Error("CLAUDE_PROJECT_DIR and CLAUDE_CODE_SESSION_ID are required");
  }

  const stateFile = `${projectDir}/.agents/tmp/persona/${sessionId}`;

  if (action === "planner" || action === "worker") {
    mkdirSync(dirname(stateFile), { recursive: true });
    writeFileSync(stateFile, `${action}\n`);
    return { action, persona: action, stateFile };
  }

  if (action === "clear") {
    rmSync(stateFile, { force: true });
    return { action, persona: null, stateFile };
  }

  if (action === "status") {
    return { action, persona: readPersona(stateFile), stateFile };
  }

  throw new Error(`Unknown action: ${action}`);
}

function readPersona(stateFile: string): Persona | null {
  if (!existsSync(stateFile)) return null;
  const value = readFileSync(stateFile, "utf-8").trim();
  return value === "planner" || value === "worker" ? value : null;
}

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

/* v8 ignore next 11 */
if (import.meta.main) {
  try {
    print(
      runPersonaState(process.argv[2] ?? "status", {
        projectDir: process.env.CLAUDE_PROJECT_DIR,
        sessionId: process.env.CLAUDE_CODE_SESSION_ID,
      }),
    );
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}
