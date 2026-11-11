#!/usr/bin/env bun
import {
  clearPersona,
  isPersona,
  readPersona as readPersonaState,
  resolveStateFile,
  writePersona,
  type Persona,
} from "../../../hooks/lib/state.ts";

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

/**
 * state ファイルのパスを決める。プロジェクトとセッションの両方が必要
 *
 * @param env - プロジェクトのディレクトリとセッション ID
 * @returns state ファイルのパス
 */
function requireStateFile(env: PersonaStateEnv): string {
  if (!env.projectDir || !env.sessionId) {
    throw new Error(
      "--project-dir and --session (or CLAUDE_PROJECT_DIR and CLAUDE_CODE_SESSION_ID) are required",
    );
  }
  return resolveStateFile(env.projectDir, env.sessionId);
}

/** persona 名以外の action と、その処理（結果の persona を返す） */
const STATE_ACTIONS = {
  clear: (stateFile: string): Persona | null => {
    clearPersona(stateFile);
    return null;
  },
  status: (stateFile: string): Persona | null => readPersonaState(stateFile) ?? null,
} as const;

function isStateAction(action: string): action is keyof typeof STATE_ACTIONS {
  return Object.hasOwn(STATE_ACTIONS, action);
}

export function runPersonaState(action: string, env: PersonaStateEnv): PersonaStateResult {
  const stateFile = requireStateFile(env);

  if (isPersona(action)) {
    writePersona(stateFile, action);
    return { action, persona: action, stateFile };
  }
  if (isStateAction(action)) {
    return { action, persona: STATE_ACTIONS[action](stateFile), stateFile };
  }
  throw new Error(`Unknown action: ${action}`);
}

export type PersonaStateArgs = {
  action: string;
  sessionId: string | undefined;
  projectDir: string | undefined;
};

// `[--project-dir <dir>] [--session <id>] [action]` を解釈する。skill は
// `--project-dir "${CLAUDE_PROJECT_DIR}" --session ${CLAUDE_SESSION_ID} $ARGUMENTS` で呼ぶ。
// Bash ツールの環境には CLAUDE_PROJECT_DIR が渡らないので、skill 本文の置換値を引数で受け取る。
// $ARGUMENTS が空でも値を action と取り違えないよう、どちらもフラグで受け取る。
export function parseArgs(argv: readonly string[]): PersonaStateArgs {
  const rest = [...argv];
  const takeFlag = (name: string): string | undefined => {
    const index = rest.indexOf(name);
    if (index === -1) return undefined;
    const value = rest[index + 1] || undefined;
    rest.splice(index, 2);
    return value;
  };
  const sessionId = takeFlag("--session");
  const projectDir = takeFlag("--project-dir");
  return { action: rest[0] ?? "status", sessionId, projectDir };
}

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

/* v8 ignore start */
if (import.meta.main) {
  try {
    const args = parseArgs(process.argv.slice(2));
    print(
      runPersonaState(args.action, {
        projectDir: args.projectDir ?? process.env.CLAUDE_PROJECT_DIR,
        sessionId: args.sessionId ?? process.env.CLAUDE_CODE_SESSION_ID,
      }),
    );
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}
/* v8 ignore stop */
